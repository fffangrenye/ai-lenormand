const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

export type Card = {
  name_cn: string;
  name_en: string;
  position: string;
  orientation_cn: string;
  love: string;
  career: string;
  psychology: string;
};

export type AIResponse = {
  answer: string;
  cards: Card[];
  memories: string[];
};

export type Project = {
  id: number;
  user_id: number;
  name: string;
  type: string;
  summary: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const demoProjects: Project[] = [
  { id: 1, user_id: 1, name: "我和 A 的关系", type: "love", summary: "关系咨询项目" },
  { id: 2, user_id: 1, name: "下一份工作选择", type: "career", summary: "职业发展项目" }
];

const demoCards: Card[] = [
  {
    name_cn: "恋人",
    name_en: "The Lovers",
    position: "现状",
    orientation_cn: "正位",
    love: "关系中存在吸引和选择，也需要确认双方是否愿意诚实表达。",
    career: "你正在面对合作或方向选择。",
    psychology: "你在寻找被理解，也需要确认自己的边界。"
  },
  {
    name_cn: "隐士",
    name_en: "The Hermit",
    position: "阻碍",
    orientation_cn: "逆位",
    love: "沉默可能正在放大不安，关系需要更清晰的沟通。",
    career: "过度独自消化会拖慢判断。",
    psychology: "先把事实和焦虑拆开，会更容易判断下一步。"
  },
  {
    name_cn: "星星",
    name_en: "The Star",
    position: "建议",
    orientation_cn: "正位",
    love: "关系仍有修复空间，但需要温和、具体、不过度追问的行动。",
    career: "适合重新建立长期信心。",
    psychology: "把注意力放回自己的稳定感。"
  }
];

function demoOracle(question: string): AIResponse {
  return {
    cards: demoCards,
    memories: ["用户正在关注与 A 的关系节奏。"],
    answer:
      `我先接住你的问题：“${question}”。\n\n` +
      "这组牌不把关系判成某个固定结局，而是提示你：吸引仍在，但沉默和猜测正在制造额外压力。\n\n" +
      "恋人说明你在意这段连接，也希望得到明确回应；隐士逆位提醒你，不要把对方的短暂停顿直接解释成否定；星星给出的建议是，用平静、具体的话表达你的需要。\n\n" +
      "可以先发一句轻一点的信息，例如：我注意到你昨天没有回复，我有点在意，也想知道你现在方便聊吗？之后给自己一个观察期限，看对方是否愿意持续回应。"
  };
}

export function getProjects() {
  return request<Project[]>("/projects").catch(() => demoProjects);
}

export function createProject(name: string, type: string) {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name, type, user_id: 1 })
  }).catch(() => ({ id: Date.now(), user_id: 1, name, type, summary: "本地预览项目" }));
}

export function askOracle(question: string, spread: string, domain: string, projectId?: number) {
  return request<AIResponse>("/oracle", {
    method: "POST",
    body: JSON.stringify({ question, spread, domain, project_id: projectId, user_id: 1 })
  }).catch(() => demoOracle(question));
}

export function sendChat(projectId: number, message: string) {
  return request<AIResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, message, user_id: 1 })
  }).catch(() => ({
    cards: [],
    memories: ["本地预览模式：项目记忆会在正式后端启动后持久保存。"],
    answer:
      `我听见你说：“${message}”。\n\n` +
      "先不用急着把对方的行为解释成一个最终答案。更稳的做法是分成三层看：事实是什么、你被触发了什么感受、你希望对方怎样回应。然后用一句不指责的话表达需要，同时观察对方是否愿意配合沟通。"
  }));
}
