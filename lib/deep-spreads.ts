export type DeepSpreadId = "three_card" | "five_card_linear" | "matrix_six" | "cross_five" | "choice_two" | "choice_three" | "h_seven" | "nine_grid";
export type SpreadPosition = { label: string; row: number; col: number };
export type SpreadPath = { label: string; indices: number[]; meaning: string };
export type DeepSpread = {
  id: DeepSpreadId; name: string; subtitle: string; suitable: string; example: string;
  rows: number; cols: number; positions: SpreadPosition[]; paths: SpreadPath[]; rules: string; choiceCount?: number;
};
const position = (label: string, row: number, col: number): SpreadPosition => ({ label, row, col });
const path = (label: string, indices: number[], meaning: string): SpreadPath => ({ label, indices, meaning });
export const deepSpreads: DeepSpread[] = [
  { id: "three_card", name: "三张牌", subtitle: "看清一件事的主线", suitable: "适合具体、聚焦的单一问题，快速了解起点、发展与趋势。", example: "未来一个月，这次合作会怎样发展？", rows: 1, cols: 3,
    positions: [position("起点",0,0),position("发展",0,1),position("趋势",0,2)], paths: [path("发展主线",[0,1,2],"从起点到发展再到趋势，按相邻组合形成一句连贯回答")], rules: "阅读 1+2、2+3，再整合 1→2→3。第二张连接起点与趋势；第三张是条件性落点，不是必然结局。" },
  { id: "five_card_linear", name: "五张线性牌阵", subtitle: "梳理事情的发展过程", suitable: "适合关系推进、工作进展和一段时间内的变化，需要看清中间转折。", example: "接下来三个月，我的工作项目会经历哪些变化？", rows: 1, cols: 5,
    positions: [position("起点",0,0),position("前段发展",0,1),position("核心主题",0,2),position("后段发展",0,3),position("结尾倾向",0,4)], paths: [path("发展过程",[0,1,2,3,4],"以第三张为核心，逐对阅读相邻牌，整合整条过程"),path("首尾呼应",[0,4],"比较起点与结尾，作为主线的补充而非推翻主线")], rules: "第三张是核心，依次阅读 1+2、2+3、3+4、4+5；1+5、2+4 仅作补充镜像。不要把五张牌分别写成确定结论。" },
  { id: "matrix_six", name: "矩阵牌阵", subtitle: "六张 · 看见表层与深层", suitable: "适合局面分析、反复出现的困境，区分外在表现与背后影响。", example: "为什么这件事一直卡住，表面和深层分别是什么？", rows: 2, cols: 3,
    positions: [position("表层·起点",0,0),position("表层·当前",0,1),position("表层·趋势",0,2),position("深层·起点",1,0),position("深层·当前",1,1),position("深层·趋势",1,2)],
    paths: [path("表层发展",[0,1,2],"可观察到的起点、当前表现和趋势"),path("深层影响",[3,4,5],"同一阶段背后的条件、动机或资源，作为解释假设"),path("起点对照",[0,3],"比较起点的表层表现与深层条件"),path("当前对照",[1,4],"比较当前表现与背后影响，找出矛盾或支持"),path("趋势对照",[2,5],"结合趋势及其成立条件")], rules: "本站采用 2×3 固定排法。先读上下两条三牌线，再读三组纵向对照。不把深层牌当作已证实的秘密或他人真实想法；不指定某一张为全阵中心。" },
  { id: "cross_five", name: "十字牌阵", subtitle: "五张 · 围绕核心找突破口", suitable: "适合明确的困境、行动卡点，梳理当前主题、前因、后续与上下层影响。", example: "这次沟通的核心卡点是什么，我可以从哪里着手？", rows: 3, cols: 3,
    positions: [position("核心主题",1,1),position("前因",1,0),position("后续倾向",1,2),position("想法与期待",0,1),position("现实基础",2,1)],
    paths: [path("事情发展",[1,0,2],"前因经过核心，形成后续倾向"),path("想法与现实",[3,0,4],"比较期待、核心问题与现实基础的关系")], rules: "本站采用五张十字：1 中心、2 左、3 右、4 上、5 下。中心锚定主题；读 2→1→3 的发展轴及 4→1→5 的上下轴，最后合并判断。不是塔罗凯尔特十字，不使用塔罗牌位解释。" },
  { id: "choice_two", name: "二选一牌阵", subtitle: "六张 · 比较两条路径", suitable: "适合两个具体选项的比较，例如去留、两份工作或两种行动方案。", example: "同样在未来三个月，选择 A 和选择 B 分别会怎样？", rows: 3, cols: 2, choiceCount: 2,
    positions: [position("A·起点",0,0),position("A·过程",1,0),position("A·趋势",2,0),position("B·起点",0,1),position("B·过程",1,1),position("B·趋势",2,1)],
    paths: [path("选项 A",[0,1,2],"选择 A 后的起点、过程与趋势"),path("选项 B",[3,4,5],"选择 B 后的起点、过程与趋势")], rules: "两条独立三牌线，各读起点→过程→趋势，再按同一目标和时间范围比较投入、阻力与可持续性。不能跨选项连读相邻编号，不能仅凭一张好牌替用户作决定，不给伪精确胜率。" },
  { id: "choice_three", name: "三选一牌阵", subtitle: "九张 · 比较三种可能", suitable: "适合三个清晰的方案，比较各自的发展过程、代价和适用条件。", example: "在相同目标下，A、B、C 三个方案各自的优势和限制是什么？", rows: 3, cols: 3, choiceCount: 3,
    positions: [position("A·起点",0,0),position("A·过程",1,0),position("A·趋势",2,0),position("B·起点",0,1),position("B·过程",1,1),position("B·趋势",2,1),position("C·起点",0,2),position("C·过程",1,2),position("C·趋势",2,2)],
    paths: [path("选项 A",[0,1,2],"A 的起点、过程和趋势"),path("选项 B",[3,4,5],"B 的起点、过程和趋势"),path("选项 C",[6,7,8],"C 的起点、过程和趋势")], rules: "三条独立三牌线，以同一目标和时间范围比较条件与代价。这个九张布局属于选择牌阵，不按九宫格读中心、横排或对角线；不能将三个分支拼接为一条时间线。" },
  { id: "h_seven", name: "H 牌阵", subtitle: "七张 · 看双方与连接", suitable: "适合关系、合作和谈判，分别看双方状态及连接双方的关键因素。", example: "我与对方在这次合作中各自处于什么状态，连接点在哪里？", rows: 3, cols: 3,
    positions: [position("我方·想法",0,0),position("我方·表现",1,0),position("我方·基础",2,0),position("双方连接点",1,1),position("对方·想法",0,2),position("对方·表现",1,2),position("对方·基础",2,2)],
    paths: [path("我方状态",[0,1,2],"我方的想法、可观察表现与基础条件"),path("对方状态",[4,5,6],"对方的可能立场、表现与基础条件"),path("双方如何连接",[1,3,5],"双方现实表现通过连接点形成的互动")], rules: "本站采用七张 H 形：左列 1–3 是我方，中央 4 是连接点，右列 5–7 是对方。两列分别从上往下读，再读 2→4→6 的连接线；不是过去未来时间线，不能当作读心证据。" },
  { id: "nine_grid", name: "九宫格", subtitle: "九张 · 展开完整局面", suitable: "适合多因素交织的主题，需要综合理解思想、现实、基础与时间变化。", example: "接下来一个月，这段关系的整体局面和关键影响是什么？", rows: 3, cols: 3,
    positions: [position("思想·过去",0,0),position("思想·当下",0,1),position("思想·趋势",0,2),position("现实·过去",1,0),position("核心主题",1,1),position("现实·趋势",1,2),position("基础·过去",2,0),position("基础·当下",2,1),position("基础·趋势",2,2)],
    paths: [path("思想与期待",[0,1,2],"思想层面的背景、当下与趋势"),path("现实表现",[3,4,5],"现实情况围绕中心展开"),path("深层基础",[6,7,8],"基础条件、负担和潜在影响"),path("过去背景",[0,3,6],"三层的过去背景"),path("当下焦点",[1,4,7],"三层的当下条件"),path("后续趋势",[2,5,8],"三层的条件性趋势"),path("对角线一",[0,4,8],"补充说明影响如何通过中心延伸"),path("对角线二",[6,4,2],"补充另一条影响路径")], rules: "第五张为中心，四角 1、3、7、9 提供背景；上中下横排分别读思想、现实、基础，左中右纵列读过去、当下、趋势。先核心和主线，再有选择地用对角线与镜像交叉核对，不把所有组合堆满正文，不强行预测精确时间。" }
];
export function isDeepSpread(value: string): value is DeepSpreadId { return deepSpreads.some((spread) => spread.id === value); }
export function getDeepSpread(id: string): DeepSpread { return deepSpreads.find((spread) => spread.id === id) || deepSpreads[0]; }
export function positionLabels(spread: DeepSpread, choices: string[] = []) {
  return spread.positions.map((slot) => slot.label.replace(/^([ABC])·/, (_, letter: string) => `${choices[letter.charCodeAt(0) - 65] || letter}·`));
}
