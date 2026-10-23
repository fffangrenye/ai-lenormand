// Chinese summaries of the existing project's core lexicon, not quotations from books.
export const coreCardMeaningsZh: Record<number, string> = {
  1: "消息到来、靠近与新的动态", 2: "小机会、短暂的顺利与轻松感", 3: "移动、距离与探索",
  4: "家庭、生活基础与熟悉的边界", 5: "成长、根基与较慢的积累", 6: "信息模糊、困惑与不确定",
  7: "复杂性、曲折路径与策略", 8: "结束、停顿与阶段收束", 9: "善意、礼物与愉快的回应",
  10: "切断、突发转折与取舍", 11: "冲突、重复与反复处理", 12: "交流、紧张与来回讨论",
  13: "开始、较小规模与初始阶段", 14: "谨慎、策略与识别不合适之处", 15: "力量、保护与控制",
  16: "方向、希望与清晰的愿景", 17: "变化、改善与迁移", 18: "朋友、支持与可靠的关系",
  19: "独立、机构与边界", 20: "公开场合、社交与群体连接", 21: "阻碍、延迟与难以跨越的距离",
  22: "选择、分支与不同路径", 23: "消耗、损失与逐渐侵蚀", 24: "感情、喜欢与情感投入",
  25: "约定、联系与循环", 26: "未知、知识与尚未公开的信息", 27: "书面信息、文件与表达",
  28: "男性当事人与其所处位置", 29: "女性当事人与其所处位置", 30: "成熟、平静与长久经验",
  31: "清晰、活力与顺利的表现", 32: "感受、认可与形象", 33: "关键、确认与打开局面的条件",
  34: "资源、流动与数量", 35: "稳定、持续与固定", 36: "负担、责任与困难的考验"
};

// PDF pages are 1-based physical PDF pages, not printed page numbers.
// Only the cited sections were checked; this is not a full-book retrieval index.
export const verifiedReadingSources = [
  { title: "Lenormand Thirty-Six Cards", author: "Andy Boroveshengra", pdfPages: [52, 62], guidance: "组合解释随问题语境变化，优先理解相邻牌之间的限定关系，不把固定组合表当成唯一答案。" },
  { title: "The Essential Lenormand, Second Edition", author: "Rana George", pdfPages: [18, 21, 27], guidance: "符号通过相邻组合形成信息；具体含义取决于语境。时间方法有条件，不强行给每张牌指定精确时间。" },
  { title: "The Complete Lenormand Oracle Handbook", author: "Caitlín Matthews", pdfPages: [39, 40], guidance: "将牌义组织成关系而非逐张孤立罗列；辨明主题与限定条件后再组织解释。" },
  { title: "The Language of Lenormand", author: "Erika Robinson", pdfPages: [47], guidance: "问题提供阅读语境，三张牌可构成连续句意；不为补足篇幅加入牌面没有提供的信息。" }
];
