import { appendFileSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { ExtractedFactSchema, type ExtractedFact } from '@repo/schema';

const logToFile = (label: string, content: string) => {
  const entry = `=== [${new Date().toISOString()}] ${label} ===\n${content}\n\n`;
  appendFileSync('llm-debug.log', entry, 'utf-8');
};

const client = new OpenAI({
  baseURL: process.env.OPENAI_API_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY ?? 'ollama',
});
const model = process.env.OPENAI_CHAT_MODEL ?? 'qwen2.5:7b';

export const generateNpcReply = async (
  npcName: string,
  knownFacts: string[],
  playerMessage: string,
): Promise<string> => {
  const validFacts = knownFacts.filter((f) => !PLACEHOLDER_PATTERN.test(f));
  const factsText =
    validFacts.length === 0
      ? '（まだ何も知らない）'
      : validFacts.map((f) => `- ${f}`).join('\n');

  const npcMessages = [
    {
      role: 'system' as const,
      content: `あなたは「${npcName}」というNPCです。次の情報を知っています：\n${factsText}\nプレイヤーの発言に自然な日本語で1〜3文で返答してください。必ず提供された情報のみを使って答えてください。情報の確信度が低い場合（推測・噂・うろ覚え）は「たしか〜」「〜と聞いています」などの曖昧な表現を使い、知らないことは「わかりません」などと自然に答えてください。`,
    },
    { role: 'user' as const, content: playerMessage },
  ];
  logToFile(
    'generateNpcReply - REQUEST',
    npcMessages.map((m) => `[${m.role}] ${m.content}`).join('\n'),
  );

  const response = await client.chat.completions.create({
    model,
    messages: npcMessages,
  });

  const reply = response.choices[0]?.message.content ?? '';
  logToFile('generateNpcReply - RESPONSE', reply);
  return reply;
};

const PLACEHOLDER_PATTERN = /不明|unknown|？|\?|未定|なし|none/i;

export const generateFactsFromQuestion = async (
  npcName: string,
  playerMessage: string,
  existingFacts: string[],
): Promise<ExtractedFact[]> => {
  const confirmedFacts = existingFacts.filter((f) => !PLACEHOLDER_PATTERN.test(f));
  const existingText =
    confirmedFacts.length === 0
      ? '（まだ何も知らない）'
      : confirmedFacts.map((f) => `- ${f}`).join('\n');

  const messages = [
    {
      role: 'system' as const,
      content: `あなたはナラティブゲームの世界設定を管理するロアエンジンです。
NPC「${npcName}」がプレイヤーの質問に答えるために必要な事実を生成してください。

【重要】プレイヤーが「あなた」と言った場合、それはNPC「${npcName}」自身を指します。
NPC「${npcName}」は自分自身の名前・役割・勤め先などの基本情報を常に知っています。
また、NPC「${npcName}」は自分の職業・役割に関連することであれば全て知っています。
例えば酒場の娘なら、料理・酒・常連客・店のルール・おすすめ品なども知っています。
職業・役割に関連する質問には必ず事実を生成してください。

NPCがすでに知っている情報：
${existingText}

ルール：
- すでに知っている情報と重複する事実は生成しない
- NPC「${npcName}」の立場から知りえる情報のみ生成する（自分自身のことは必ず知っている）
- certaintyは確信度（0.0〜1.0）。確実な情報は1.0、推測・噂・うろ覚えは0.3〜0.7で生成してよい
- NPC自身に関する質問（名前・住居・出身・家族・職業・日常など）は推測でも低いcertaintyで必ず事実を生成する
- NPCの職業・役割に関連する質問も推測でよいので必ず事実を生成する
- {"facts": []} を返すのは、NPCが全く関与しえない第三者・遠方・専門外の話題のみ
- subjectNameには「あなた」や「私」ではなく必ず具体的な名前を使う
- objectNameに「不明」「？」「未定」などのプレースホルダーは絶対に使わない。確定できない場合はそのfactを生成しない
- predicateは必ず以下のいずれかを使用する：
  - is（状態・性質・名前）
  - located_in（空間的な所在）
  - related_to（関係・つながり）
  - part_of（構成要素・所属）
  - caused_by（因果）
  - seeks（意図・欲求）

例）プレイヤー「あなたの名前は？」→ {"facts": [{"subjectName":"${npcName}","predicate":"is","objectName":"[名前]","certainty":1.0}]}
例）プレイヤー「ここはどこ？」→ {"facts": [{"subjectName":"${npcName}","predicate":"located_in","objectName":"[場所名]","certainty":1.0}]}
例）プレイヤー「あなたの酒場の名前は？」→ {"facts": [{"subjectName":"この酒場","predicate":"is","objectName":"[酒場名]","certainty":1.0}]}
例）プレイヤー「あなたの住んでいる町は？」→ {"facts": [{"subjectName":"${npcName}","predicate":"located_in","objectName":"[町名]","certainty":0.9}]}

形式: {"facts": [{"subjectName":"...","predicate":"...","objectName":"...","certainty":0.0〜1.0}]}`,
    },
    {
      role: 'user' as const,
      content: `プレイヤーの質問: ${playerMessage}`,
    },
  ];
  logToFile(
    'generateFactsFromQuestion - REQUEST',
    messages.map((m) => `[${m.role}] ${m.content}`).join('\n'),
  );

  const response = await client.chat.completions.create({
    model,
    response_format: FACTS_JSON_SCHEMA,
    messages,
  });

  const raw = response.choices[0]?.message.content ?? '{"facts":[]}';
  logToFile('generateFactsFromQuestion - RESPONSE', raw);
  return parseFacts(raw);
};

const ExtractedFactsSchema = z.object({ facts: z.array(ExtractedFactSchema) });

const VALID_PREDICATES = ['is', 'located_in', 'related_to', 'part_of', 'caused_by', 'seeks'] as const;
type ValidPredicate = (typeof VALID_PREDICATES)[number];

const PREDICATE_MAP: Record<string, ValidPredicate> = {
  is_part_of: 'part_of',
  contains: 'part_of',
  belongs_to: 'part_of',
  is_name_of: 'is',
  named: 'is',
  has_name: 'is',
  is_located_in: 'located_in',
  lives_in: 'located_in',
  works_at: 'located_in',
  is_related_to: 'related_to',
  is_familiar_with: 'related_to',
  knows: 'related_to',
  is_caused_by: 'caused_by',
  results_from: 'caused_by',
  wants: 'seeks',
  desires: 'seeks',
};

const normalizePredicate = (predicate: string): ValidPredicate => {
  if ((VALID_PREDICATES as readonly string[]).includes(predicate)) {
    return predicate as ValidPredicate;
  }
  const mapped = PREDICATE_MAP[predicate];
  if (mapped) return mapped;
  logToFile('parseFacts - FALLBACK', `unknown predicate "${predicate}" → related_to`);
  return 'related_to';
};

const FACTS_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'facts',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        facts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              subjectName: { type: 'string' },
              predicate: { type: 'string', enum: VALID_PREDICATES },
              objectName: { type: 'string' },
              certainty: { type: 'number' },
            },
            required: ['subjectName', 'predicate', 'objectName', 'certainty'],
            additionalProperties: false,
          },
        },
      },
      required: ['facts'],
      additionalProperties: false,
    },
  },
} as const;

const parseFacts = (raw: string): ExtractedFact[] => {
  const parsed = ExtractedFactsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    logToFile('parseFacts - ERROR', parsed.error.message);
    return [];
  }
  return parsed.data.facts.flatMap((f) => {
    if (PLACEHOLDER_PATTERN.test(f.objectName)) {
      logToFile('parseFacts - SKIP', `placeholder objectName: "${f.objectName}"`);
      return [];
    }
    return [{ ...f, predicate: normalizePredicate(f.predicate) }];
  });
};

export const extractFactsFromText = async (text: string): Promise<ExtractedFact[]> => {
  const messages = [
    {
      role: 'system' as const,
      content: `以下のテキストから事実をJSONで抽出してください。
断言されている情報は certainty:1.0、「らしい」「と聞いた」などの伝聞は certainty:0.5 程度にしてください。
predicateは必ず以下のいずれかを使用してください：
- is（状態・性質・名前）
- located_in（空間的な所在）
- related_to（関係・つながり）
- part_of（構成要素・所属）
- caused_by（因果）
- seeks（意図・欲求）
事実がなければ {"facts": []} を返してください。`,
    },
    { role: 'user' as const, content: text },
  ];
  logToFile('extractFactsFromText - REQUEST', messages.map((m) => `[${m.role}] ${m.content}`).join('\n'));

  const response = await client.chat.completions.create({
    model,
    response_format: FACTS_JSON_SCHEMA,
    messages,
  });

  const raw = response.choices[0]?.message.content ?? '{"facts":[]}';
  logToFile('extractFactsFromText - RESPONSE', raw);
  return parseFacts(raw);
};

export const extractFacts = async (
  npcName: string,
  playerMessage: string,
  npcReply: string,
): Promise<ExtractedFact[]> => {
  const extractMessages = [
    {
      role: 'system' as const,
      content: `NPCの発言から、NPCが述べている事実のみをJSONで返してください。
プレイヤーの発言（質問・あいさつなど）は無視し、NPCの発言に含まれる情報だけを抽出してください。
形式: {"facts": [{"subjectName":"...","predicate":"...","objectName":"...","certainty":0.0〜1.0}]}
事実がなければ {"facts": []} を返してください。
predicateは必ず以下のいずれかを使用してください：
- is（状態・性質）
- located_in（空間的な所在）
- related_to（関係・つながり）
- part_of（構成要素・所属）
- caused_by（因果）
- seeks（意図・欲求）`,
    },
    {
      role: 'user' as const,
      content: `（参考・プレイヤーの質問）: ${playerMessage}\n（${npcName}の返答）: ${npcReply}`,
    },
  ];
  logToFile(
    'extractFacts - REQUEST',
    extractMessages.map((m) => `[${m.role}] ${m.content}`).join('\n'),
  );

  const response = await client.chat.completions.create({
    model,
    response_format: FACTS_JSON_SCHEMA,
    messages: extractMessages,
  });

  const raw = response.choices[0]?.message.content ?? '{"facts":[]}';
  logToFile('extractFacts - RESPONSE', raw);
  return parseFacts(raw);
};
