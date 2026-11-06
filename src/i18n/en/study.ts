import type { Entry } from '../index';

/** 练习作答 / 评分 / 学习统计 / 查询表 / 作答详情 */
export const enStudy: Record<string, Entry> = {
  /* ---------- 练习页作答 ---------- */
  题目要求: 'Prompt',
  示范朗读: 'Model reading',
  播放示范朗读: 'Play model reading',
  播放发音: 'Play pronunciation',
  根据标准发音写出单词: 'Write the word you hear from the standard pronunciation.',
  按录音: 'Record',
  听自己上一次录音: 'Listen to your last recording',
  '按住录音，松开结束': 'Hold to record, release to stop',
  '录音中 #s，松开结束': 'Recording #s — release to stop',
  在这里作答: 'Write your answer here',
  '在这里作答…': 'Write your answer here…',
  输入占位: 'Input',
  随机选题: 'Random question',
  选择文体: 'Choose a genre',
  不限: 'Any',
  题目: 'Questions',
  下一题: 'Next',
  上一词: 'Previous word',
  下一词: 'Next word',
  完成: 'Done',
  查看解析: 'Show analysis',
  收起解析: 'Hide analysis',
  加入题集: 'Add to note',
  移出题集: 'Remove from note',
  听力原文: 'Transcript',
  定位句: 'Evidence sentence',
  正确拼写: 'Correct spelling',
  参考范文: 'Model answer',
  题目解析: 'Question analysis',
  正确答案: 'Correct',
  你的选择: 'Your choice',
  '{option}，{mark}': '{option} — {mark}',
  重试评分: 'Retry grading',
  原始作答: 'Original answer',
  作答详情: 'Answer details',
  分项得分: 'Section scores',
  具体问题定位: 'Specific issues',
  改进建议: 'Suggestions',
  参考译文: 'Reference translation',
  参考内容: 'Reference',
  '总分（满分 100）': 'Total score (out of 100)',
  评分时间: 'Graded at',
  评分完成: 'Grading complete',
  该题库下暂无此题型的题目: 'No questions for this type in this bank yet',
  可换一个题库再试: 'Try a different bank',
  重新选择题库: 'Choose another bank',
  文章: 'Passage',
  来自阅读理解标记的生词: 'Words marked while reading',
  '本次没有发现需要标注的问题。': 'Nothing to flag this time.',
  离线查看我的作答: 'View my answer offline',
  '你的作答已保留，可以稍后重试；重试成功后覆盖失败记录，不产生重复记录。':
    'Your answer is saved — retry later; a successful retry replaces the failed record without duplicating it.',
  '作答内容已离线保留，可以回到练习页重新提交；重试成功后覆盖失败记录，不产生重复记录。':
    'Your answer is saved offline — resubmit from the Practice page; a successful retry replaces the failed record without duplicating it.',
  '（空作答）': '(empty answer)',
  词: 'word',
  '词 ·': 'word ·',
  '词 · 当前': 'word · current',
  ' · 查词': ' · look up',
  '查询 #': 'Look up #',
  '用时 #': 'Time #',
  '错词听写：#': 'Dictation of wrong words: #',
  '至多重播 # 次，已播 # 次': 'Up to # replays; # used',
  '重播次数已用完（# 次）': 'No replays left (#)',

  /* ---------- 练习结算页（最后一题提交后点「下一题」进入） ---------- */
  本场练习已完成: 'Session complete',
  '客观题 {n} 道 · 正确 {c} · 错误 {w}': '{n} objective · {c} correct · {w} wrong',
  '主观题 {n} 道（记录分数，不计对错）': '{n} subjective (scored, not marked right or wrong)',
  '{s} 分': '{s} pts',
  正确: 'Correct',
  错误: 'Wrong',
  未作答: 'Not answered',
  '第 {n} 题': 'Question {n}',
  '第 {n} 题，{s}': 'Question {n}, {s}',
  重做本场: 'Restart session',
  '{name} · 共 {n} 题': '{name} · {n} questions',

  /* ---------- 评分反馈 / 错误 ---------- */
  '第 # 题': 'Question #',
  见原文: 'see the passage',
  评分失败: 'Grading failed',
  '评分失败，请稍后重试': 'Grading failed — please try again later',
  '评分超时，请检查网络后重试': 'Grading timed out — check your connection and retry',
  '正在评分…': 'Grading…',
  正在评分: 'Grading',
  '正在评分，请勿离开本页，草稿已保留': 'Grading — stay on this page; your draft is saved',
  'AI 服务暂时不可用，请稍后重试': 'The AI service is unavailable right now — please try again later',
  '请求过于频繁，请稍候再试': 'Too many requests — please try again shortly',
  '登录状态已失效，请重新登录后再评分': 'Your session expired — sign in again before grading',
  '作答过短或缺少有效内容，无法体现题目要点。':
    'The answer is too short or lacks substance to show the key points.',
  '保持这个节奏，继续下一题。': 'Keep this pace and move on to the next question.',
  '保证每句话都有主语和谓语。': 'Make sure every sentence has a subject and a verb.',
  '停顿略多，建议跟着示范朗读连读两遍。':
    'A few too many pauses — read along with the model twice.',
  '先按题目要点列出 2-3 个关键信息，再逐句展开。':
    'List 2–3 key points first, then expand them sentence by sentence.',
  '参考范文已给出，重点看它如何用连接词串起段落。':
    'A model answer is provided — note how connectives link the sentences.',
  '同义但正确的表达不会被判为错误，优先保证信息完整。':
    'Correct synonyms are not penalised; completeness comes first.',
  '回到定位句，逐句划出与选项对应的关键词。':
    'Go back to the evidence sentence and underline the keywords for each option.',
  '回放自己的录音，与示范朗读逐句对比。':
    'Play your recording back and compare it sentence by sentence with the model.',
  '对照参考译文，挑 1-2 处替换成更地道的搭配。':
    'Compare with the reference translation and swap 1–2 phrases for more natural ones.',
  '平均句长偏长，建议拆句或加入连接词。':
    'Average sentence length is long — split sentences or add connectives.',
  '建议按原句结构分句，避免一句到底。':
    'Split the text following the source structure instead of one long sentence.',
  '把长句拆成意群，按意群换气。': 'Break long sentences into thought groups and breathe between them.',
  '拼写正确，继续下一题。': 'Spelling is correct — continue to the next question.',
  '按上面的问题定位逐条改写，再提交一次对比分数变化。':
    'Revise item by item per the issues above, then resubmit and compare your score.',
  '未形成完整的句子结构。': 'No complete sentence structure yet.',
  '注意重读实词，弱读虚词；本次重音位置基本正确。':
    'Stress content words and weaken function words; your stress placement was mostly correct.',
  '结构清晰，可以把重点放在句式变化上。': 'Clear structure — focus on varying your sentences next.',
  '译文偏长，中文原意可用更简洁的英文表达。':
    'The translation is wordy — the Chinese can be said more concisely in English.',
  '译文明显短于原文，可能漏译了信息。':
    'The translation is much shorter than the source; some information may be missing.',
  '重复用词较多，可换用同义词提升表达层次。':
    'Repeated words — swap in synonyms to vary your expression.',
  拼写准确: 'Spelling accuracy',
  理解: 'Comprehension',
  流利度: 'Fluency',
  地道度: 'Naturalness',
  要点覆盖: 'Key points',
  内容: 'Content',
  结构: 'Structure',
  语言: 'Language',
  连贯: 'Cohesion',
  语序: 'Word order',
  句子停顿: 'Pauses',
  句子长度: 'Sentence length',
  重音位置: 'Stress placement',
  整段: 'Paragraph',
  整篇: 'Whole text',
  本词: 'This word',
  全篇用词: 'Overall word choice',
  '字数 #，低于题目要求的 # 词，展开不足。':
    '# words — below the required #; not developed enough.',
  '把 # 加入错题队列，今天再拼一遍。': '# added to the wrong-answer queue — spell it again today.',
  '未覆盖要点：#': 'Missing key points: #',
  '正确拼写是 #': 'The correct spelling is #',
  '正确答案是「#」，定位句：#': 'The correct answer is “#” — evidence: #',

  /* ---------- 学习统计 ---------- */
  学习统计与数据管理: 'Statistics & data',
  累计学习天数: 'Total study days',
  累计总时长: 'Total time',
  累计完成任务: 'Total completed tasks',
  '各题型正确率（近 30 天）': 'Accuracy by exercise type (last 30 days)',
  看正确率曲线: 'View accuracy curve',
  打开能力趋势: 'Open ability trends',
  生成并复制学习记录: 'Generate and copy study records',
  查看详情: 'View details',
  没有可查看的记录: 'No records to show',
  '已生成并复制到剪贴板': 'Generated and copied to the clipboard',
  已删除: 'Deleted',
  删除这条记录: 'Delete this record',
  删除全部学习记录: 'Delete all study records',
  '删除全部学习记录后这里会保持为空': 'This stays empty once you delete all study records',
  '删除全部学习记录后，历史作答不可恢复':
    'Once all records are deleted, past answers cannot be restored',
  '删除后不可恢复：练习记录、连续天数、能力趋势统计与写作本都会被清空，且不再参与词库排行统计。':
    'This cannot be undone: practice records, streak, trend statistics and the writing book are cleared and no longer count toward wordbook rankings.',
  '删除后练习页计数与查询表会按剩余明细重新计算。需要清空全部记录时，请到「更多 — Statistics」使用「删除全部学习记录」（二次确认，删除后不可恢复）。':
    'Counters and the report are recomputed from the remaining entries. To clear everything, use “Delete all study records” under More — Statistics (confirmation required, cannot be undone).',
  '全部学习记录已清空，练习页计数器与查询表已回到空数据态。':
    'All study records cleared — Practice counters and the report are back to empty.',
  '导出格式为可读文本（CSV 或 JSON），与练习页查询表使用同一份数据源与同一种格式。':
    'Exports plain text (CSV or JSON) from the same source and format as the Practice report.',
  '各题型正确率（近 30 天）_key': 'Accuracy by exercise type (last 30 days)',
  '格式：#，共 # 行。可直接粘贴到任何文本工具中保存。':
    'Format: #, # lines. Paste into any text tool to save.',
  '预览（前 # 行 / 共 # 行）': 'Preview (first # of # lines)',
  '近 # 天：练习 # 天 · # · # 个任务 · 平均得分率 #':
    '# Days: # practice days · # · # tasks · average accuracy #',
  '# 正确率曲线': '# accuracy curve',
  '# 分': '# pt',
  '# · 用时 #': '# · time #',
  '# 分 上升': '# pt, rising',
  '# 分 下降': '# pt, falling',
  '# 分 持平': '# pt, flat',

  /* ---------- 能力趋势 ---------- */
  统计范围: 'Scope',
  时长: 'Time',
  板块筛选: 'Track filter',
  '板块筛选（可多选）': 'Track filter (multi-select)',
  展开趋势: 'Expand trend',
  收起趋势: 'Collapse trend',
  题库筛选: 'Bank filter',
  当前水平: 'Current level',
  日: 'day',
  周: 'week',
  月: 'month',
  完成任意一个题型后: 'Finish any exercise type and',
  '完成任意一个题型后，这里会显示统计结果': 'Finish any exercise type to see statistics here',
  '# 天': '# days',
  '# 个': '#',
  '# 次': '#×',
  '练习 # 次': '# sessions',
  '{n} 次': '{n}×',
  '得分率 #%': 'Accuracy #%',
  '最高 # · 最低 #': 'best # · worst #',

  /* ---------- 统计口径说明 ---------- */
  '区间内全部已评分作答的平均得分率。':
    'Average accuracy across every graded answer in the period.',
  '累计得分 ÷ 累计满分后的平均值，用于让不同满分标准的题型横向比较。':
    'Weighted average (total score ÷ total possible) so types with different maxima compare fairly.',
  '该区间内已提交并完成的任务个数，未提交答案就退出不计入，与练习页任务数计数器同口径。':
    'Tasks submitted and completed in the period; exiting without submitting does not count — same definition as the Practice counter.',
  '该区间内所有练习任务的实际用时之和，切后台超过 30 秒暂停计时，与练习页时长计数器同口径。':
    'Total actual time on practice tasks in the period; timing pauses after 30 seconds in the background — same definition as the Practice counter.',
  '该区间内练习过（时长或任务数大于 0）的自然日数量，与练习页打卡计数器同口径。':
    'Calendar days with any practice (time or tasks > 0) — same definition as the Practice check-in counter.',
  '该题型全部已评分作答的平均分（满分 100）。':
    'Average score of every graded answer for this type (out of 100).',
  '该题型历史最高分。': 'Highest score ever for this type.',
  '该题型历史最低分。': 'Lowest score ever for this type.',
  '该题型完成的任务数。': 'Tasks completed for this type.',
  '该题型最近一次作答的分数。': 'Score of the most recent answer for this type.',
  '该题型的完成次数，同一任务重复提交只计一次。':
    'Times completed for this type; resubmitting the same task counts once.',
  '该题型累计用时。': 'Total time spent on this type.',
  '当前水平：按所选统计时段（今日 / 近7天 / 近30天 / 近3月）的平均得分率分五档。':
    'Current level: five bands based on average accuracy over the selected period (Today / 7 Days / 30 Days / 3 Months).',

  /* ---------- 练习日历（每周摘要 / 补签） ---------- */
  每周摘要: 'Weekly summary',
  '查看练习日历，可补签漏掉的日期': 'Open the practice calendar to make up a missed day',
  练习日历: 'Practice calendar',
  练习摘要: 'Summary',
  打卡日历: 'Check-in calendar',
  日历范围: 'Calendar range',
  日历日期: 'Calendar day',
  本周: 'This week',
  本月: 'This month',
  今年: 'This year',
  '{y} 年全年': 'All of {y}',
  补签: 'Make-up',
  已补签: 'Made up',
  有练习: 'Practiced',
  '有练习，未达标': 'Practiced, goal missed',
  未练习: 'No practice',
  '当前连续 {n} 天': 'Streak: {n} days',
  周一: 'Mon',
  周二: 'Tue',
  周三: 'Wed',
  周四: 'Thu',
  周五: 'Fri',
  周六: 'Sat',
  周日: 'Sun',
  补签规则: 'Make-up rules',
  '每个自然周可补签 {n} 天，本周还剩 {left} 次。':
    'You can make up {n} day per calendar week; {left} left this week.',
  '只能补签今天之前 {n} 天内的日期；今天与未来不需要补签。':
    'Only days within the last {n} days can be made up — today and the future need no catch-up.',
  '补签只把这一天记为签到，不会补上练习时长与任务数，学习统计仍以实际练习为准。':
    'A make-up only marks the day as checked in. It adds no practice minutes or tasks — statistics still come from real practice.',
  补签这一天: 'Make up this day',
  '已补签，连续天数已接上。': 'Made up — your streak is connected again.',
  '补签后这一天记为签到，连续天数会重新接上；本周还剩 {n} 次额度。':
    'This day will count as checked in and your streak reconnects. {n} make-up left this week.',
  '这一周的免费补签额度已用完，下周会有新的额度。':
    'The free make-up for that week is used up — a new one arrives next week.',
  '超出可补签的时间范围，只能补最近 {n} 天。':
    'That day is too far back; only the last {n} days can be made up.',
  '这一天已经是签到状态，不用补签。': 'This day is already checked in.',
  '今天与未来的日期不需要补签，先练起来就好。': 'Today and future days need no make-up — just start practising.',

  /* ---------- 带占位符的模板（trf） ---------- */
  '录音中 {s}s，松开结束': 'Recording {s}s — release to stop',
  '查询 {w}': 'Look up {w}',
  '重播次数已用完（{n} 次）': 'No replays left ({n})',
  '至多重播 {n} 次，已播 {u} 次': 'Up to {n} replays; {u} used',
  '错词听写：{w}': 'Dictation of wrong words: {w}',
  '字数 {n}，低于题目要求的 {t} 词，展开不足。':
    '{n} words — below the required {t}; not developed enough.',
  '把 {w} 加入错题队列，今天再拼一遍。': '{w} added to the wrong-answer queue — spell it again today.',
  '未覆盖要点：{list}': 'Missing key points: {list}',
  '正确拼写是 {w}': 'The correct spelling is {w}',
  '正确答案是「{a}」，定位句：{e}': 'The correct answer is “{a}” — evidence: {e}',
  '{time} · 用时 {v}': '{time} · time {v}',
  '{name} 正确率曲线': '{name} · accuracy curve',
  '暂无趋势，需至少练习同一项目两日':
    'No trend yet — practise the same item on at least two days',
  '暂无趋势，需至少两天的练习记录': 'No trend yet — at least two days of practice are needed',
  任务数: 'Tasks',
  切换指标: 'Switch metric',
  分: 'min',
  '得分率 {v}%': 'Accuracy {v}%',
  '最高 {max} · 最低 {min}': 'best {max} · worst {min}',
  '格式：{fmt}，共 {n} 行。可直接粘贴到任何文本工具中保存。':
    'Format: {fmt}, {n} lines. Paste into any text tool to save.',
  '近 30 天：练习 {d} 天 · {t} · {n} 个任务 · 平均得分率 {r}':
    '30 Days: {d} practice days · {t} · {n} tasks · average accuracy {r}',
  '预览（前 12 行 / 共 {n} 行）': 'Preview (first 12 of {n} lines)',
  '{n} / 16 字符': '{n} / 16 characters',

  '评分时间 {v}': 'Graded at {v}',
  '达标规则：{v}': 'Goal rule: {v}',

  /* ---------- 测验（积累 / 综合） ---------- */
  积累: 'Accumulation',
  开始积累: 'Start accumulation',
  选择积累数量: 'Choose how many words',
  积累数量: 'How many',
  '{n} 词': '{n} words',
  '{n} 词，已确认': '{n} words selected',
  '选定积累数量，按中文释义写出对应的英文词或短语。':
    'Pick how many words, then write the English word or phrase for each Chinese meaning.',
  本次得分: 'Your score',
  '满分 {n}': 'Out of {n}',
  答对词数: 'Correct',
  '{n} / {m} 词': '{n} / {m} words',
  再测一次: 'Try again',
  暂无可抽的词条: 'No words available yet',
  换一个题库后再试: 'Try another question bank',

  /* ---------- 阅读理解点词（翻译 / 收入默认收藏夹） ---------- */
  '{w}，已选中': '{w} — selected',
  暂无释义: 'No definition yet',
  收入默认收藏夹: 'Save to default',
  移出默认收藏夹: 'Remove from default',
};
