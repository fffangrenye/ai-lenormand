"use client";

import { Loader2, MessageCircle, Plus, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Project, createProject, getProjects, sendChat } from "@/lib/api";

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function SpacePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("他昨天没有回复我，我应该主动问吗？");
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("我和 A 的关系");

  useEffect(() => {
    getProjects().then((items) => {
      setProjects(items);
      setActive(items[0] || null);
    }).catch(() => undefined);
  }, []);

  async function addProject() {
    const project = await createProject(newName, "love");
    setProjects((items) => [project, ...items]);
    setActive(project);
    setMessages([]);
  }

  async function submit() {
    if (!active || !draft.trim()) return;
    const userMessage = draft;
    setDraft("");
    setMessages((items) => [...items, { role: "user", content: userMessage }]);
    setLoading(true);
    try {
      const response = await sendChat(active.id, userMessage);
      setMessages((items) => [...items, { role: "ai", content: response.answer }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr_280px]">
      <aside className="rounded-lg border border-white/10 bg-panel p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold">咨询项目</h1>
          <button title="创建项目" onClick={addProject} className="grid h-9 w-9 place-items-center rounded-md bg-white/10 hover:bg-white/15">
            <Plus size={18} />
          </button>
        </div>
        <input value={newName} onChange={(event) => setNewName(event.target.value)} className="mt-4 w-full rounded-md border border-white/10 bg-ink p-3 text-sm outline-none focus:border-violet" />
        <div className="mt-4 grid gap-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setActive(project)}
              className={`rounded-md p-3 text-left transition ${active?.id === project.id ? "bg-violet text-white" : "bg-ink/70 text-white/72 hover:bg-white/10"}`}
            >
              <p className="font-medium">{project.name}</p>
              <p className="mt-1 text-xs opacity-70">{project.type}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[720px] flex-col rounded-lg border border-white/10 bg-white/[0.055]">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-gold" />
            <h2 className="font-semibold">{active?.name || "先创建一个咨询项目"}</h2>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-white/54">这里会保存同一个项目下的长期咨询脉络。</div>
          ) : (
            messages.map((message, index) => (
              <div key={index} className={`max-w-[82%] rounded-lg p-4 leading-7 ${message.role === "user" ? "ml-auto bg-violet text-white" : "bg-ink text-white/82"}`}>
                {message.content}
              </div>
            ))
          )}
          {loading ? <Loader2 className="animate-spin text-gold" size={22} /> : null}
        </div>
        <div className="flex gap-3 border-t border-white/10 p-4">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 rounded-md border border-white/10 bg-ink p-3 outline-none focus:border-violet" />
          <button title="发送" onClick={submit} className="grid h-12 w-12 place-items-center rounded-md bg-gold text-ink hover:bg-gold/90">
            <Send size={18} />
          </button>
        </div>
      </section>

      <aside className="rounded-lg border border-white/10 bg-panel p-4">
        <h2 className="font-semibold">Memory</h2>
        <div className="mt-4 grid gap-3 text-sm leading-6 text-white/66">
          <p className="rounded-md bg-ink/70 p-3">项目背景、历史牌面和情绪线索会在这里逐步沉淀。</p>
          <p className="rounded-md bg-ink/70 p-3">MVP 已预留 pgvector 记忆检索结构。</p>
        </div>
      </aside>
    </main>
  );
}
