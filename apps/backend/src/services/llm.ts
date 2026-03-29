import { appendFileSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { ExtractedFactSchema, type ExtractedFact, type NpcPersona, type ConversationMessage } from '@repo/schema';

const logToFile = (label: string, content: string) => {
  const entry = `=== [${new Date().toISOString()}] ${label} ===\n${content}\n\n`;
  appendFileSync('llm-debug.log', entry, 'utf-8');
};

const client = new OpenAI({
  baseURL: process.env.OPENAI_API_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY ?? 'ollama',
});
const model = process.env.OPENAI_CHAT_MODEL ?? 'qwen2.5:7b';

const HISTORY_LIMIT = 5;

export const generateNpcReply = async (
  npcName: string,
  knownFacts: string[],
  playerMessage: string,
  persona?: NpcPersona,
  history?: ConversationMessage[],
): Promise<string> => {
  const validFacts = knownFacts.filter((f) => !PLACEHOLDER_PATTERN.test(f));
  const factsText =
    validFacts.length === 0
      ? '（まだ何も知らない）'
      : validFacts.map((f) => `- ${f}`).join('\n');

  const personaText = persona
    ? [
        persona.roles.length > 0 ? `職業・役割: ${persona.roles.join('、')}` : '',
        persona.personalities.length > 0 ? `性格・口調: ${persona.personalities.join('、')}` : '',
        persona.knowledgeScopes.length > 0 ? `知識範囲: ${persona.knowledgeScopes.join('、')}` : '',
      ]
        .filter(Boolean)
        .join('\n') + '\n'
    : '';

  const historyMessages = history
    ? history.slice(-HISTORY_LIMIT * 2).map((m) => ({
        role: m.role === 'player' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }))
    : [];

  const npcMessages = [
    {
      role: 'system' as const,
      content: `あなたは「${npcName}」というNPCです。\n${personaText}次の情報を知っています：\n${factsText}\nプレイヤーの発言に自然な日本語で1〜3文で返答してください。提供された情報をもとに返答し、直接の情報がなくても既知の情報から合理的に推測できることは答えてよいです。確信度が低い推測は「たしか〜」「〜じゃないかな」などの曖昧な表現を使い、全く手がかりがないことだけ「わかりません」と答えてください。`,
    },
    ...historyMessages,
    { role: 'user' as const, content: playerMessage },
  ];
  logToFile(
    'generateNpcReply - REQUEST',
    npcMessages.map((m) => `[${m.role}] ${m.content}`).join('\n'),
  );

  const response = await client.chat.completions.create({
    model,
    messages: npcMessages,
    max_tokens: 512,
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
  persona?: NpcPersona,
): Promise<ExtractedFact[]> => {
  const confirmedFacts = existingFacts.filter((f) => !PLACEHOLDER_PATTERN.test(f));
  const existingText =
    confirmedFacts.length === 0
      ? '（まだ何も知らない）'
      : confirmedFacts.map((f) => `- ${f}`).join('\n');

  const personaSection = persona
    ? [
        persona.roles.length > 0 ? `NPC「${npcName}」の職業・役割: ${persona.roles.join('、')}` : '',
        persona.knowledgeScopes.length > 0 ? `NPC「${npcName}」の知識範囲: ${persona.knowledgeScopes.join('、')}` : '',
        '職業・役割に関連する質問には必ず事実を生成してください。',
      ]
        .filter(Boolean)
        .join('\n')
    : `NPC「${npcName}」は自分自身の名前・役割・勤め先などの基本情報を常に知っています。
また、NPC「${npcName}」は自分の職業・役割に関連することであれば全て知っています。
例えば酒場の娘なら、料理・酒・常連客・店のルール・おすすめ品なども知っています。
職業・役割に関連する質問には必ず事実を生成してください。`;

  const messages = [
    {
      role: 'system' as const,
      content: `あなたはナラティブゲームの世界設定を管理するロアエンジンです。
NPC「${npcName}」がプレイヤーの質問に答えるために必要な事実を生成してください。

【重要】プレイヤーが「あなた」と言った場合、それはNPC「${npcName}」自身を指します。
${personaSection}

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
- objectNameは中立的・客観的な事実の表現にする。語尾・口調・感情表現（「だぜ」「だよ」「ね」など）は絶対に含めない
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
    max_tokens: 512,
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

export const extractFactsFromText = async (text: string, playerMessage?: string): Promise<ExtractedFact[]> => {
  const contextLine = playerMessage ? `プレイヤーの質問: ${playerMessage}\nNPCの返答: ${text}` : text;
  const messages = [
    {
      role: 'system' as const,
      content: `以下のテキストから事実をJSONで抽出してください。
プレイヤーの質問が付いている場合は、質問の文脈を踏まえて返答から事実を読み取ってください。
断言されている情報は certainty:1.0、「らしい」「と聞いた」などの伝聞は certainty:0.5 程度にしてください。
predicateは必ず以下のいずれかを使用してください：
- is（状態・性質・名前）
- located_in（空間的な所在）
- related_to（関係・つながり）
- part_of（構成要素・所属）
- caused_by（因果）
- seeks（意図・欲求）

例）「酒場の娘の名前はリン」→ {"facts":[{"subjectName":"酒場の娘","predicate":"is","objectName":"リン","certainty":1.0}]}
例）「銀嶺亭は街の中心にある」→ {"facts":[{"subjectName":"銀嶺亭","predicate":"located_in","objectName":"街の中心","certainty":1.0}]}
例）「店主はドワーフらしい」→ {"facts":[{"subjectName":"店主","predicate":"is","objectName":"ドワーフ","certainty":0.5}]}

事実がなければ {"facts": []} を返してください。`,
    },
    { role: 'user' as const, content: contextLine },
  ];
  logToFile('extractFactsFromText - REQUEST', messages.map((m) => `[${m.role}] ${m.content}`).join('\n'));

  const response = await client.chat.completions.create({
    model,
    response_format: FACTS_JSON_SCHEMA,
    messages,
    max_tokens: 512,
  });

  const raw = response.choices[0]?.message.content ?? '{"facts":[]}';
  logToFile('extractFactsFromText - RESPONSE', raw);
  return parseFacts(raw);
};

