export type NpcDefinition = {
  name: string;
  role: string;
  personality: string;
  knowledgeScope: string;
};

export const NPC_REGISTRY: Record<string, NpcDefinition> = {
  '酒場の娘': {
    name: '酒場の娘',
    role: '酒場の給仕',
    personality: '明るく親しみやすい。常連客には砕けた口調、初対面には丁寧語。',
    knowledgeScope: '酒・料理・値段・常連客の噂・酒場周辺の出来事。遠方の政治や魔法には疎い。',
  },
};

export const getNpcDefinition = (npcName: string): NpcDefinition | undefined =>
  NPC_REGISTRY[npcName];

export const listNpcNames = (): string[] => Object.keys(NPC_REGISTRY);
