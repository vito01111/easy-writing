import type { PromptFileDef } from './types'

/** 其余域的提示词默认值（竞品拆书 / 封面） */
export const MISC_PROMPT_FILES: PromptFileDef[] = [
  {
    id: 'breakdown',
    name: '竞品拆书',
    group: '竞品拆书',
    description: '单章拆解、黄金三章深拆与全书报告',
    slots: [
      {
        key: 'system',
        label: '编辑系统设定',
        variables: ['JSON形状', '补充要求'],
        defaultTemperature: 0.35,
        defaultText: [
          '你是一位中文网文章节拆解分析师（资深网文编辑），负责把竞品内容拆成结构化分析结果。',
          '只输出一个 JSON 对象，禁止 Markdown、解释、额外前后缀。',
          'JSON 形状：{{JSON形状}}',
          '所有文案用中文，评语要具体可学习，不写空话；所有描述必须基于给到的章节内容，不得编造正文里不存在的关键事实。',
          '{{补充要求}}',
        ].join('\n'),
      },
      {
        key: 'chapterShape',
        label: '输出结构-单章拆解',
        defaultText: [
          '{"summary":"本章细纲：150-250字讲清本章发生什么、冲突与结果",',
          '"outline":[{"title":"节点名（4-8字）","startPara":1,"endPara":5,"text":"该节点做了什么、为什么有效（40-80字）",',
          '"tags":[{"text":"钩子","tone":"hot"},{"text":"铺垫","tone":""}]}],',
          '"rhythm":[{"label":"维度名（如 开篇钩子/冲突密度/章末悬念）","value":"强/中/弱或数值","desc":"一句话点评"}],',
          '"setting":[{"name":"设定名","type":"类型（力量体系/地点/组织/道具等）","desc":"一句话说明","tags":["标签"]}],',
          '"relations":[{"from":"甲","to":"乙","relation":"关系（师徒/敌对等）","desc":"本章体现"}]}',
        ].join(''),
      },
      {
        key: 'goldenShape',
        label: '输出结构-黄金三章',
        defaultText: [
          '{"hook300":"前300字用什么钩住读者、是否奏效（60-100字）",',
          '"characterEstablish":"主角人设是否立住、靠什么立住（60-100字）",',
          '"coreDilemma":"本章抛出的核心困境与读者期待（60-100字）",',
          '"anchors":[{"quote":"原文摘句（≤40字）","comment":"这句好在哪（≤40字）"}]}',
        ].join(''),
      },
      {
        key: 'reportShape',
        label: '输出结构-全书报告',
        defaultText: [
          '{"editorNotes":"编辑手记：这本书最值得学的两三点（120-200字）",',
          '"outlineRecovery":[{"stage":"阶段名","chapters":"1-10","goal":"该阶段目标","payoff":"兑现方式"}],',
          '"characterArcs":[{"name":"人物名","keyChapters":[1,5],"arc":"弧线概述（40-80字）"}],',
          '"foreshadowLedger":[{"item":"伏笔内容","plantChapter":1,"payoffChapter":8,"status":"recovered"}],',
          '"pacingCurve":[{"chapterNo":1,"score":4,"label":"开篇钩子"}],',
          '"reusableTechniques":["可直接套用的技巧1","技巧2"]}',
        ].join(''),
      },
      {
        key: 'chapterNote',
        label: '单章拆解补充',
        defaultText: [
          'outline 节点 3-6 个，按剧情顺序排列；startPara/endPara 是段落编号（对应正文里的 [n] 标号），',
          '节点区间按顺序覆盖、不重叠。tags 的 tone 只允许 "hot"（爽点/钩子类）或空串。',
        ].join('\n'),
      },
      {
        key: 'goldenNote',
        label: '黄金三章补充',
        defaultText: '这是全书前三章之一，额外产出 golden 黄金三章深拆（anchors 摘 2-3 句原文）。',
      },
      {
        key: 'chapterTask',
        label: '单章拆解任务',
        defaultText: '拆解本章：细纲、关键节点（带段落区间）、爽点节奏、世界观设定、人物关系。',
      },
      {
        key: 'reportNote',
        label: '全书报告补充',
        defaultText: [
          'pacingCurve 按章给 1-5 的爽点强度分，每个已拆章一条；',
          'foreshadowLedger 的 status 只允许 "recovered"（已回收，payoffChapter 必填）或 "pending"（未回收，payoffChapter 填 0）。',
        ].join('\n'),
      },
      {
        key: 'reportTask',
        label: '全书报告任务',
        defaultText: '汇总成全书拆解报告：大纲反推、人物弧线、伏笔账本、爽点曲线、可复用技巧、编辑手记。',
      },
    ],
  },
  {
    id: 'cover-prompt',
    name: '封面画面描述',
    group: '封面',
    description: '封面工坊"AI 润色画面描述"（生图前的文案润色）',
    slots: [
      {
        key: 'system',
        label: '系统设定',
        defaultText: [
          '你是书籍封面的美术指导。把作者的口语化描述润色成一段可直接用于 AI 生图的画面描述。',
          '只输出润色后的画面描述本身（180 字以内），不要解释、不要引号、不要分点。',
          '要点：主体明确、构图与光线具体、贴合风格与色调要求；竖版书籍封面构图。',
        ].join('\n'),
      },
    ],
  },
]
