import OpenAI from 'openai';
import { z } from 'zod';
import { ExtractedFactSchema, type ExtractedFact } from '@repo/schema';

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

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `あなたは「${npcName}」というNPCです。次の情報を知っています：\n${factsText}\nプレイヤーの発言に自然な日本語で1〜3文で返答してください。`,
      },
      { role: 'user', content: playerMessage },
    ],
  });

  return response.choices[0]?.message.content ?? '';
};

const ExtractedFactsSchema = z.object({ facts: z.array(ExtractedFactSchema) });

export const extractFacts = async (
  npcName: string,
  playerMessage: string,
  npcReply: string,
): Promise<ExtractedFact[]> => {
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `以下の会話から事実を抽出し、JSONで返してください。
形式: {"facts": [{"subjectName":"...","predicate":"...","objectName":"...","certainty":0.0〜1.0}]}
事実がなければ {"facts": []} を返してください。`,
      },
      {
        role: 'user',
        content: `プレイヤー: ${playerMessage}\n${npcName}: ${npcReply}`,
      },
    ],
  });

  const raw = response.choices[0]?.message.content ?? '{"facts":[]}';
  const parsed = ExtractedFactsSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data.facts : [];
};
