import { appendFileSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  ExtractedFactSchema,
  PersonaHintsSchema,
  type ExtractedFact,
  type NpcPersona,
  type PersonaHints,
  type ConversationMessage,
} from '@repo/schema';
import { type NpcDefinition } from '@repo/npc-mind';

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
  npcDef?: NpcDefinition,
): Promise<string> => {
  const validFacts = filterRelevantFacts(
    knownFacts.filter((f) => !hasPlaceholder(f)),
    playerMessage,
    npcName,
  );
  const factsText =
    validFacts.length === 0
      ? '（まだ何も知らない）'
      : validFacts.map((f) => `- ${f}`).join('\n');

  const defLines = npcDef
    ? [
        `職業・役割: ${npcDef.role}`,
        `性格・口調: ${npcDef.personality}`,
        `知識範囲: ${npcDef.knowledgeScope}`,
      ]
    : [];

  const dynamicLines = persona
    ? [
        persona.roles.length > 0 ? `追加された役割: ${persona.roles.join('、')}` : '',
        persona.personalities.length > 0 ? `追加された口調: ${persona.personalities.join('、')}` : '',
        persona.knowledgeScopes.length > 0 ? `追加された知識範囲: ${persona.knowledgeScopes.join('、')}` : '',
      ].filter(Boolean)
    : [];

  const personaText = [...defLines, ...dynamicLines].join('\n');
  const personaSection = personaText ? personaText + '\n' : '';

  const historyMessages = history
    ? history.slice(-HISTORY_LIMIT * 2).map((m) => ({
        role: m.role === 'player' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }))
    : [];

  const npcMessages = [
    {
      role: 'system' as const,
      content: `あなたは「${npcName}」というNPCです。\n${personaSection}次の情報を知っています：\n${factsText}\nプレイヤーの発言に自然な日本語で1〜3文で返答してください。提供された情報をもとに返答し、直接の情報がなくても既知の情報から合理的に推測できることは答えてよいです。確信度が低い推測は「たしか〜」「〜じゃないかな」などの曖昧な表現を使い、全く手がかりがないことだけ「わかりません」と答えてください。\n場所・施設・人物には必ず固有名詞を使い、「この町」「ここ」「この酒場」などの指示語は使わないこと。固有名詞がまだ出ていない場合は自然な流れで名前を明かすこと。`,
    },
    ...historyMessages,
    { role: 'user' as const, content: playerMessage },
  ];
  logToFile(
    'generateNpcReply - REQUEST',
    npcMessages.map((m) => `[${m.role}] ${m.content}`).join('\n'),
  );

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await client.chat.completions.create({
      model,
      messages: npcMessages,
      max_tokens: 512,
    });
    const reply = response.choices[0]?.message.content ?? '';
    if (!isGarbageReply(reply)) {
      logToFile('generateNpcReply - RESPONSE', reply);
      return reply;
    }
    logToFile(`generateNpcReply - GARBAGE (attempt ${attempt}/${MAX_RETRIES})`, reply);
  }
  return '';
};

const PLACEHOLDER_WORD_PATTERN = /不明|unknown|未定|なし|none/i;
const hasPlaceholder = (s: string): boolean =>
  PLACEHOLDER_WORD_PATTERN.test(s) || s.includes('?') || s.includes('？') || s.includes('[');

/** モデルが内部フォーマットトークンや JSON を吐いた場合のゴミ返答判定 */
const isGarbageReply = (text: string): boolean =>
  /<\|/.test(text) ||          // <|channel|> 等のモデルトークン
  /^\s*\{/.test(text) ||       // JSON 返答
  !/[\u3040-\u30FF\u4E00-\u9FAF]/.test(text); // 日本語文字が一切ない

const MAX_FACTS_IN_PROMPT = 15;

/**
 * プレイヤーの質問に関連する fact を絞り込む。
 * - npcName が subjectName に含まれる fact（NPC 自身の情報）は常に優先
 * - 残りは質問キーワードとの一致数でスコアリングして上位を返す
 */
const filterRelevantFacts = (facts: string[], playerMessage: string, npcName: string): string[] => {
  if (facts.length <= MAX_FACTS_IN_PROMPT) return facts;

  const keywords = playerMessage
    .replace(/[。、？！「」『』【】\s]/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 2);

  const scored = facts.map((fact) => {
    const isNpcFact = fact.startsWith(npcName);
    const kwScore = keywords.reduce((acc, k) => acc + (fact.includes(k) ? 1 : 0), 0);
    return { fact, score: (isNpcFact ? 10 : 0) + kwScore };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FACTS_IN_PROMPT)
    .map((x) => x.fact);
};

export const generateFactsFromQuestion = async (
  npcName: string,
  playerMessage: string,
  existingFacts: string[],
  persona?: NpcPersona,
  npcDef?: NpcDefinition,
): Promise<ExtractedFact[]> => {
  const confirmedFacts = filterRelevantFacts(
    existingFacts.filter((f) => !hasPlaceholder(f)),
    playerMessage,
    npcName,
  );
  const existingText =
    confirmedFacts.length === 0
      ? '（まだ何も知らない）'
      : confirmedFacts.map((f) => `- ${f}`).join('\n');

  const defLines = npcDef
    ? [
        `NPC「${npcName}」の職業・役割: ${npcDef.role}`,
        `NPC「${npcName}」の知識範囲: ${npcDef.knowledgeScope}`,
      ]
    : [
        `NPC「${npcName}」は自分自身の名前・役割・勤め先などの基本情報を常に知っています。`,
        `また、NPC「${npcName}」は自分の職業・役割に関連することであれば全て知っています。`,
        `例えば酒場の娘なら、料理・酒・常連客・店のルール・おすすめ品なども知っています。`,
      ];

  const dynamicLines = persona
    ? [
        persona.roles.length > 0 ? `追加された役割: ${persona.roles.join('、')}` : '',
        persona.knowledgeScopes.length > 0 ? `追加された知識範囲: ${persona.knowledgeScopes.join('、')}` : '',
      ].filter(Boolean)
    : [];

  const personaSection = [...defLines, ...dynamicLines, '職業・役割に関連する質問には必ず事実を生成してください。'].join('\n');

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
- subjectNameには代名詞・汎称を使わない。「私」「俺」「僕」「あたし」「うち」「あなた」「君」「NPC」は絶対に禁止。固有名詞か固有の名称（「${npcName}」「黒潮亭」等）を使う
- subjectNameにプレイヤーを指す語（「君」「あなた」）は使わない
- objectNameは中立的・客観的な事実の表現にする。語尾・口調・感情表現（「だぜ」「だよ」「ね」など）は絶対に含めない
- objectNameに「不明」「？」「未定」「[名前]」「[町名]」のようなプレースホルダーは絶対に使わない
- NPC自身に関する未知の情報（住んでいる町・出身地・家族の名前など）はファンタジー世界に合う固有名詞を造語して使う
- predicateは必ず以下のいずれかを使用する：
  - is（状態・性質・名前）
  - located_in（空間的な所在）
  - related_to（関係・つながり）
  - part_of（構成要素・所属）
  - caused_by（因果）
  - seeks（意図・欲求）

例）プレイヤー「あなたの名前は？」→ {"facts": [{"subjectName":"${npcName}","predicate":"is","objectName":"リン","certainty":1.0}]}
例）プレイヤー「ここはどこ？」→ {"facts": [{"subjectName":"${npcName}","predicate":"located_in","objectName":"黒潮亭","certainty":1.0}]}
例）プレイヤー「あなたの酒場の名前は？」→ {"facts": [{"subjectName":"${npcName}","predicate":"located_in","objectName":"黒潮亭","certainty":1.0}]}
例）プレイヤー「あなたの住んでいる町は？」→ {"facts": [{"subjectName":"${npcName}","predicate":"located_in","objectName":"リューン","certainty":0.9},{"subjectName":"リューン","predicate":"is","objectName":"港町","certainty":0.8}]}

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

const VALID_PREDICATES = [
  'is',
  'located_in',
  'related_to',
  'part_of',
  'caused_by',
  'seeks',
] as const;
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
  logToFile(
    'parseFacts - FALLBACK',
    `unknown predicate "${predicate}" → related_to`,
  );
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

const PRONOUN_SUBJECTS = new Set([
  '私', '俺', '僕', 'あたし', 'うち',
  'あなた', '君', 'NPC',
]);

const parseFacts = (raw: string): ExtractedFact[] => {
  const parsed = ExtractedFactsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    logToFile('parseFacts - ERROR', parsed.error.message);
    return [];
  }
  return parsed.data.facts.flatMap((f) => {
    if (hasPlaceholder(f.objectName)) {
      logToFile('parseFacts - SKIP', `placeholder objectName: "${f.objectName}"`);
      return [];
    }
    if (PRONOUN_SUBJECTS.has(f.subjectName)) {
      logToFile('parseFacts - SKIP', `pronoun subjectName: "${f.subjectName}"`);
      return [];
    }
    return [{ ...f, predicate: normalizePredicate(f.predicate) }];
  });
};

const PERSONA_HINTS_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'persona_hints',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        personalities: { type: 'array', items: { type: 'string' } },
        roles: { type: 'array', items: { type: 'string' } },
        knowledgeScopes: { type: 'array', items: { type: 'string' } },
      },
      required: ['personalities', 'roles', 'knowledgeScopes'],
      additionalProperties: false,
    },
  },
} as const;

export const extractPersonaHintsFromReply = async (
  npcName: string,
  reply: string,
  existingPersona?: NpcPersona,
): Promise<PersonaHints> => {
  const empty: PersonaHints = {
    personalities: [],
    roles: [],
    knowledgeScopes: [],
  };

  const existingText = existingPersona
    ? [
        existingPersona.roles.length > 0
          ? `職業・役割（登録済み）: ${existingPersona.roles.join('、')}`
          : '',
        existingPersona.personalities.length > 0
          ? `性格・口調（登録済み）: ${existingPersona.personalities.join('、')}`
          : '',
        existingPersona.knowledgeScopes.length > 0
          ? `知識範囲（登録済み）: ${existingPersona.knowledgeScopes.join('、')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '（未登録）';

  const messages = [
    {
      role: 'system' as const,
      content: `NPCの返答からペルソナ情報を抽出します。

【対象NPC】${npcName}
【登録済み情報】
${existingText}

【手順】
1. 返答の中で使われている一人称（俺・僕・私・あたし・うち など）を探す
   → 登録済みに「一人称は「X」」が既にある → 追加しない（空配列）
   → 登録済みにない一人称 → personalities に「一人称は「X」」を追加（XはNPCが使った実際の言葉）
2. 登録済みにない語尾・口調の特徴があれば personalities に追加
3. 職業・役割の新情報があれば roles に追加
4. 知識範囲の新情報があれば knowledgeScopes に追加

【重要ルール】
- 値は必ず返答の中に実際に存在する言葉を使う。「?」「？」「X」などのプレースホルダーは絶対に使わない
- 確信が持てない場合は追加しない（誤情報より空のほうがよい）
- 登録済み情報と重複する場合は追加しない

【抽出例】
例1: 登録済みに「一人称は「私」」がある。返答「私、リンだぜ。」→ 「私」は登録済み → 追加なし → {"personalities":[],"roles":[],"knowledgeScopes":[]}
例2: 登録済みに一人称なし。返答「俺の名前はリンだぜ。」→ 「俺」は新しい一人称 → {"personalities":["一人称は「俺」"],"roles":[],"knowledgeScopes":[]}
例3: 登録済みに一人称なし。返答「うちの料理はおいしいって有名だよ。」→ 「うち」は新しい一人称。料理が得意。 → [{"personalities":["一人称は「うち」"],"roles":[],"knowledgeScopes":[]},{"personalities":["料理が得意"],"roles":[],"knowledgeScopes":[]}]
例4: 返答「黒潮ビーフカレーが名物だぜ。」→ 一人称なし、新情報なし → {"personalities":[],"roles":[],"knowledgeScopes":[]}`,
    },
    {
      role: 'user' as const,
      content: `NPCの返答:\n${reply}`,
    },
  ];
  logToFile(
    'extractPersonaHintsFromReply - REQUEST',
    messages.map((m) => `[${m.role}] ${m.content}`).join('\n'),
  );

  const response = await client.chat.completions.create({
    model,
    response_format: PERSONA_HINTS_JSON_SCHEMA,
    messages,
    max_tokens: 256,
  });

  const raw =
    response.choices[0]?.message.content ??
    '{"personalities":[],"roles":[],"knowledgeScopes":[]}';
  logToFile('extractPersonaHintsFromReply - RESPONSE', raw);

  const parsed = PersonaHintsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    logToFile('extractPersonaHintsFromReply - ERROR', parsed.error.message);
    return empty;
  }
  return parsed.data;
};

export const extractFactsFromText = async (
  text: string,
  playerMessage?: string,
): Promise<ExtractedFact[]> => {
  const contextLine = playerMessage
    ? `プレイヤーの質問: ${playerMessage}\nNPCの返答: ${text}`
    : text;
  const messages = [
    {
      role: 'system' as const,
      content: `以下のテキストから事実をJSONで抽出してください。
プレイヤーの質問が付いている場合は、質問の文脈を踏まえて返答から事実を読み取ってください。

【certainty の基準】
- 断言されている情報: 1.0
- 「んじゃないかな」「みたい」「たしか〜」などの推測: 0.5〜0.6
- 「らしい」「と聞いた」などの伝聞: 0.4〜0.5
推測・伝聞の情報は {"facts":[]} にせず、低めのcertaintyで必ず抽出してください。

predicateは必ず以下のいずれかを使用してください：
- is（状態・性質・名前）
- located_in（空間的な所在）
- related_to（関係・つながり）
- part_of（構成要素・所属）
- caused_by（因果）
- seeks（意図・欲求）

subjectNameのルール：
- 必ず固有名詞を使う（「銀嶺亭」「リン」「リューン」「店主ダガー」など）
- 「この町」「この酒場」「ここ」などの指示語は subjectName に使わない
- 人称代名詞（「私」「俺」「君」「あなた」）も禁止
- テキスト中に固有名詞が見つからない場合は、その事実を抽出しない（{"facts":[]} に含めない）

例）「酒場の娘の名前はリン」→ {"facts":[{"subjectName":"酒場の娘","predicate":"is","objectName":"リン","certainty":1.0}]}
例）「銀嶺亭は街の中心にある」→ {"facts":[{"subjectName":"銀嶺亭","predicate":"located_in","objectName":"街の中心","certainty":1.0}]}
例）「店主はドワーフらしい」→ {"facts":[{"subjectName":"店主","predicate":"is","objectName":"ドワーフ","certainty":0.5}]}
例）「サバやタチウオがよく獲れるんじゃないかな」→ {"facts":[{"subjectName":"近海","predicate":"related_to","objectName":"サバ・タチウオ","certainty":0.6}]}
例）「リューンは賑やかな港町で、リンはそこに住んでいる」→ {"facts":[{"subjectName":"リューン","predicate":"is","objectName":"港町","certainty":1.0},{"subjectName":"リン","predicate":"located_in","objectName":"リューン","certainty":1.0}]}
例）「この町は港町だぜ」（固有名詞なし）→ {"facts":[]}

事実がなければ {"facts": []} を返してください。`,
    },
    { role: 'user' as const, content: contextLine },
  ];
  logToFile(
    'extractFactsFromText - REQUEST',
    messages.map((m) => `[${m.role}] ${m.content}`).join('\n'),
  );

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
