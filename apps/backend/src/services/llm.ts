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
  const factsText =
    knownFacts.length === 0
      ? '（まだ何も知らない）'
      : knownFacts.map((f) => `- ${f}`).join('\n');

  const npcMessages = [
    {
      role: 'system' as const,
      content: `あなたは「${npcName}」というNPCです。次の情報を知っています：\n${factsText}\nプレイヤーの発言に自然な日本語で1〜3文で返答してください。必ず提供された情報のみを使って答え、知らないことは「わかりません」などと自然に答えてください。`,
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

export const generateFactsFromQuestion = async (
  npcName: string,
  playerMessage: string,
  existingFacts: string[],
): Promise<ExtractedFact[]> => {
  const existingText =
    existingFacts.length === 0
      ? '（まだ何も知らない）'
      : existingFacts.map((f) => `- ${f}`).join('\n');

  const messages = [
    {
      role: 'system' as const,
      content: `あなたはナラティブゲームの世界設定を管理するロアエンジンです。
NPC「${npcName}」がプレイヤーの質問に答えるために必要な事実を生成してください。

NPCがすでに知っている情報：
${existingText}

ルール：
- すでに知っている情報と重複する事実は生成しない
- NPC「${npcName}」の立場から知りえる情報のみ生成する
- 答えられない・知りえない質問には {"facts": []} を返す
- predicateは必ず以下のいずれかを使用する：
  - is（状態・性質）
  - located_in（空間的な所在）
  - related_to（関係・つながり）
  - part_of（構成要素・所属）
  - caused_by（因果）
  - seeks（意図・欲求）

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
    response_format: { type: 'json_object' },
    messages,
  });

  const raw = response.choices[0]?.message.content ?? '{"facts":[]}';
  logToFile('generateFactsFromQuestion - RESPONSE', raw);
  const parsed = ExtractedFactsSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data.facts : [];
};

const ExtractedFactsSchema = z.object({ facts: z.array(ExtractedFactSchema) });

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
    response_format: { type: 'json_object' },
    messages: extractMessages,
  });

  const raw = response.choices[0]?.message.content ?? '{"facts":[]}';
  logToFile('extractFacts - RESPONSE', raw);
  const parsed = ExtractedFactsSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data.facts : [];
};
