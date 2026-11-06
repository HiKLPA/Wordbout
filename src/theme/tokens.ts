/**
 * 设计令牌 —— 来源：Figma「Wordbout.fig / Internal Only Canvas」画板。
 * 所有数值与色值均取自设计文件，不得随意改动；颜色一律使用完整 rgb/hex 字面量。
 */

/**
 * 品牌与语义色（设计文件原值）。
 * 2026-10-16 统一品牌红 / 黄：原来 Logo·课本卡面另有一套「差 1 个色阶」的红黄
 * （`brandPrimaryAlt` #BD413C、`brandSecondaryAlt` #EBD76E），现已全部并入 `brandPrimary` / `brandSecondary`，
 * 全 App 只有一个红（#BE4B3E）和一个黄（#EEB266），卡面直接引用这两个 token。
 *
 * 2026-10-17 品牌色由三色扩到六色：在原红 / 黄 / 蓝之外新增紫 / 珊瑚 / 青三个同明度的品牌色，
 * 收藏夹色板的后三个直接指向它们（此前是写在 `FOLDER_COLORS` 里的裸色值）。
 */
export const palette = {
  /** Brand Primary（2026-10-16 由 #BE413C 调为此值，Logo 与课本 / 题集卡面同用） */
  brandPrimary: '#BE4B3E',
  /** Brand Secondary（2026-10-17 由 #EECA6C 调为 #EEB266，「Recommend / 测验」卡面与已收藏态同用） */
  brandSecondary: '#EEB266',
  /** Brand Complementary */
  brandComplementary: '#466EAA',
  /**
   * **备用蓝**（2026-10-16 新增）：与品牌三色同一族的柔和蓝，**目前没有任何主题 / 组件引用它** ——
   * 留给将来要启用「蓝色主题色」的场合（届时把 `colors.accentBlue`、`FOLDER_COLORS` 里的 `blue`
   * 指过来，或新增一套以它为 `brand` 的配色即可，不用再翻设计稿找色值）。
   */
  brandComplementaryAlt: '#4E6AA6',
  /** Brand Violet（2026-10-17 新增）：收藏夹色板第 4 色 */
  brandViolet: '#965E95',
  /** Brand Coral（2026-10-17 新增）：收藏夹色板第 5 色 */
  brandCoral: '#D6786D',
  /** Brand Teal（2026-10-17 新增）：收藏夹色板第 6 色 */
  brandTeal: '#418A84',

  /** Text Primary (Black Primary) */
  textPrimary: '#2D2D2D',
  /** Text Secondary */
  textSecondary: '#494949',
  /** Text Main */
  textMain: '#545454',
  /** 题型 pill 文字色（设计稿实测） */
  textMuted: '#717171',

  /** Invert */
  invert: '#F5F5F5',
  /** Surface White */
  surfaceWhite: '#FFFFFF',
  /** Surface BKG */
  surfaceBkg: '#EBEBEB',
  /** Surface Content */
  surfaceContent: '#EFEFEF',
  /** 分割线灰 */
  divider: '#D9D9D9',

  /** Icon Default / Secondary / Invert */
  iconDefault: '#2D2D2D',
  iconSecondary: '#494949',
  iconInvert: '#F5F5F5',

} as const;

/**
 * 收藏夹封面可选颜色（新建收藏夹时六选一）。
 * **六个全部指向品牌色 token**（红 / 黄 / 蓝 / 紫 / 珊瑚 / 青）—— 2026-10-17 起后三个不再写裸色值，
 * 与前三色一样统一由 `palette` 管理；`label` 是界面标签（只用于无障碍名，中文原文为键、走 `tr()`）。
 * 卡片封面上的文件夹图标**恒白**（`colors.brandOn`，全 App「文字 / 图标白」同一档）；
 * 色板上的勾同样恒取 `colors.brandOn`（2026-10-17 起不再按底色明暗自适应，黄底也不转深色）。
 *
 * 注意 `id` 是**持久化键**（收藏夹数据里存的就是它），改色时只换 `value` / `label`：
 * 第 5 色的 id 仍是历史名 `amber`，现在指向品牌珊瑚色。
 */
export const FOLDER_COLORS = [
  { id: 'red', label: '红', value: palette.brandPrimary },
  { id: 'yellow', label: '黄', value: palette.brandSecondary },
  { id: 'blue', label: '蓝', value: palette.brandComplementary },
  { id: 'violet', label: '紫', value: palette.brandViolet },
  { id: 'amber', label: '珊瑚', value: palette.brandCoral },
  { id: 'teal', label: '青', value: palette.brandTeal },
] as const;

export type FolderColor = (typeof FOLDER_COLORS)[number]['id'];

/** 默认封面颜色：也是老数据与内置「默认」收藏夹的颜色 */
export const DEFAULT_FOLDER_COLOR: FolderColor = 'red';

/**
 * 课本卡面色（`Wordbook.tone`）：品牌三色里的红 / 黄 / 蓝。
 * 它同时是**词库详情页的页面强调色**（整页 `AccentProvider` 取同一个值，见 app/library/[bookId].tsx）——
 * 卡片长什么样，点进去那一页就是什么色。三个值对应的色值与 `FOLDER_COLORS` 的品牌三色一致。
 */
export type BookTone = 'red' | 'yellow' | 'blue';

export const BOOK_TONE_COLORS: Record<BookTone, string> = {
  red: palette.brandPrimary, // #BE4B3E
  yellow: palette.brandSecondary, // #EEB266
  blue: palette.brandComplementary, // #466EAA
};

/** 收藏夹封面底色：没选过颜色（含老数据）时回落品牌红 */
export function folderColorValue(color?: FolderColor): string {
  return (FOLDER_COLORS.find((c) => c.id === color) ?? FOLDER_COLORS[0]).value;
}

/** 设计稿尺寸 */
export const layout = {
  /** iPhone 16/17 Pro 设计画布 */
  screenWidth: 402,
  screenHeight: 874,
  /** 页面左右内边距（主内容区距屏幕边界）—— 屏宽 - 36 */
  pagePadding: 18,
  /** 底部悬浮导航条（宽度随屏宽自适应 —— 左右各留 32px，见 BottomBar.BAR_SIDE_MARGIN） */
  barWidth: 354,
  /**
   * 底栏专用左右外边距（屏宽 - 2 × 该值）；要改底栏宽度只改这一个数。
   * **只归底栏**（2026-10-17 起）：居中弹窗（`DialogPanel` 与 `more.tsx` 头像弹窗）
   * 改用主内容区的 `pagePadding`（18），弹窗与页面正文同宽、比底栏宽一档。
   */
  barSideMargin: 32,
  barHeight: 64,
  barBottom: 32,
  barRadius: 9999,
  /** BarIcon 单元高 = 条带高 64（满铺：28x28 图标 + 2 间距 + 12px 标签，行高 17，内容共 47、居中） */
  barItemWidth: 67,
  barItemHeight: 64,
  barIconSize: 28,
  /** 题型 pill */
  pillHeight: 48,
  pillHeightLarge: 52,
  /**
   * 输入框内边距（全 App 统一值）。两种形态都取它：
   * - 胶囊类（主页翻译条 / AI 探索输入行 / 作答胶囊）：**外层容器**给左右内边距 16，内层 `TextInput` 清零；
   * - 矩形类（翻译页多行输入框 / 练习主观题作答框 / 昵称 / 定时 / 弹层输入框）：直接给输入框自身。
   * 单行胶囊高度固定、文字靠 `textAlignVertical: 'center'` 居中，所以 `paddingVertical` 仍为 0。
   */
  inputPad: 16,
  /**
   * 学习进度条统一高度（课本卡卡面 / 词库页学习进度 / 练习页三段进度条）。
   * 圆角取半高（2）。要调整全 App 进度条粗细，只改这一个数。
   */
  progressHeight: 4,
  /** Textbook 卡片 */
  bookWidth: 192,
  bookCoverHeight: 192,
  bookLabelHeight: 48,
  /** 卡片圆角（全 App 所有卡片 / 面板统一值：`Card`、题集卡、课本卡、收藏夹卡、翻译页卡…） */
  cardRadius: 32,
  /** 竖向区块间距 */
  sectionGap: 32,
} as const;

/**
 * 描边粗细（全 App 统一 0.5px，按钮 / 面板 / 输入框 / 选项卡同一套）。
 * 只有这一个值：选中 / 激活态**不加粗**，改用品牌红等状态色区分，线宽处处一致。
 * 要整体调粗细，只改这一个数。
 */
export const stroke = {
  base: 0.5,
} as const;

/**
 * 透明度档（2026-10-14）：全 App 只有这两档，不再就地在组件里写死数字。
 * 两档的差别是**可交互性**，不是「看起来弱多少」：
 * - `disabled` —— 控件真的不可用（`onPress` 置 undefined、`disabled`、只读、无数据），压得更狠；
 * - `muted` —— 控件仍可点，只是处于次要 / 进行中 / 被前置条件拦住的状态，只降一级视觉权重。
 * 为什么 disabled 能压得更狠：WCAG 1.4.3 对 inactive 控件豁免对比度要求；
 * `muted` 那档内容仍要读、仍要满足 NFR-7 的 4.5:1，所以必须留更多亮度。
 */
export const opacity = {
  /** 不可用：`Button` disabled、弹层确认圆钮、`StarButton`、`Toggle`、播放 / 重播圆钮、只读输入框 */
  disabled: 0.6,
  /** 仍可交互但非主行动：主页功能钮被隐私政策拦住、AI 探索发送中 */
  muted: 0.8,
} as const;

/**
 * 遮罩色：目前只剩**左侧单词列表抽屉**（`WordListDrawer`）在用 ——
 * 居中弹窗（`DialogPanel` / 更多页头像弹窗）已于 2026-10-17 去掉外部黑底，不再铺遮罩。
 * 全 App 不要再就地写 `rgba(...)`。
 * 半透明近黑（12,12,12 的 40%）：压暗下层内容、让抽屉明确浮在最上层，
 * 又不到纯黑 —— 再暗一档下层内容就糊成一片、失掉层次。
 * 这里只给**底色**，总的浓淡由 `OVERLAY_FADE_IN` / `OVERLAY_FADE_OUT` 把不透明度从 0 带到 1 决定。
 */
export const SCRIM = 'rgba(12,12,12,0.4)';

/**
 * 浮层（遮罩）的淡入 / 淡出时长（ms）：全 App **唯一一套**淡入淡出节奏 ——
 * 目前只有左侧抽屉（`WordListDrawer`）取这里。居中弹窗**没有任何弹出 / 收起动画**
 * （2026-10-17 删除：形变、位移、面板不透明度全部移除），所以弹窗不再参与这套节奏。
 * 淡入 160 比淡出 120 略慢：亮起来时留一点过渡、暗下去时干脆。
 */
export const OVERLAY_FADE_IN = 160;
export const OVERLAY_FADE_OUT = 120;

/** 字号（英文/数字 Barlow，汉字 思源黑体）。小字只有 `micro` / `tiny` 两档，`caption` / `bar` 已并入 `micro` */
export const typography = {
  /** ENG 12 —— 小字档：底栏标签、副行、小节标题、数量角标、进度条标签共用 */
  micro: 12,
  /** ENG 14 —— 二级小字档：中文释义 / 译文、卡片副行、面板小节标题 */
  tiny: 14,
  /** ENG 16 */
  sm: 16,
  /** ENG 18 */
  md: 18,
  /** ENG 24 */
  lg: 24,
  /** ENG 32 */
  xl: 32,
  /** ENG 48 —— 介于 `xl`(32) 与 `xxxl`(64) 之间的大字档（课本封面书名等） */
  xxl: 48,
  /** ENG 64 */
  xxxl: 64,
  /** ENG 128 */
  display: 128,
  /** Body 行高 */
  bodyLineHeight: 28,
  /**
   * 各档位行高（显式指定，不交给字体度量决定）。
   * 汉字思源黑体的行盒比 Barlow 高，若不写死行高，切语言会让同一行文字高度变化、
   * 页面整体重排；写死之后中英文行盒完全一致（NFR-8 的排版一致性）。
   */
  lineHeights: {
    display: 172,
    xxxl: 86,
    xxl: 64,
    xl: 42,
    lg: 32,
    md: 24,
    sm: 22,
    /** 小字档行高（原 `bar` 的 17：12px 汉字行盒刚好放得下，不挤） */
    micro: 17,
    /** 二级小字档行高（14px 汉字行盒刚好放得下） */
    tiny: 19,
  },
} as const;

/**
 * 字号档位（FR-O-2：字号提供三档并实时预览）。
 * 与系统字体缩放叠加生效。
 */
export const FONT_SCALES = [0.875, 1, 1.15] as const;
export const FONT_SCALE_LABELS = ['默认', '中', '大'] as const;

/** 语义化配色：浅色 / 深色两套，正文对比度均 ≥ 4.5:1（NFR-7） */
export interface SemanticColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  text: string;
  /** Text Main（#545454）—— 介于正文与次要文字之间的中性灰 */
  textMain: string;
  textSecondary: string;
  textMuted: string;
  divider: string;
  icon: string;
  iconMuted: string;
  brand: string;
  brandOn: string;
  accentYellow: string;
  accentBlue: string;
  /** 例句中当前单词的高亮红（正文对比度 ≥ 4.5:1，NFR-7） */
  accentRed: string;
  /**
   * 外描边：按钮 / 面板 / 输入框 / 选项卡 统一用这一个色（浅 **#FFFFFF** / 深 **#3A3A3A**，
   * 高对比度模式另取高反差值）。**不要再新增第二种描边色**；选中 / 失效等状态色仍用 `brand`。
   */
  border: string;
  /**
   * 进度条**底槽**色（线性进度条 + `ProgressRing` 环槽共用同一个参数）：
   * **独立参数**，当前取值与 `border` 完全一致
   * （浅 **#FFFFFF** / 深 **#3A3A3A** / 高对比度浅 #000000、深 #9A9A9A）。
   * 之所以不直接引用 `border`，是为了以后能只调进度槽而不动全局描边（反之亦然）。
   */
  progressTrack: string;
  /** 底栏条带底色（不透明实色，与 surface 同底；高对比度模式下取纯黑/纯白保证对比度） */
  barBackground: string;
  /**
   * 反向面板底：**取对方模式 `surface` 的值**（浅色 #1C1C1C / 深色 #EFEFEF）。
   * 用在需要在两种模式下都与面板拉开强烈反差的小圆片上（如释义序号圆标）。
   */
  surfaceInvert: string;
  /** `surfaceInvert` 底上的文字 / 图标色（浅色取深色的白 #F5F5F5 / 深色取浅色的黑 #2D2D2D） */
  surfaceInvertOn: string;
}

export type ColorSchemeName = 'light' | 'dark';

export const semanticColors: Record<ColorSchemeName, SemanticColors> = {
  light: {
    bg: palette.surfaceBkg, // #EBEBEB
    // 面板实底：比 bg #EBEBEB 亮两档（#F5F5F5）；不再复用 palette.surfaceContent（#EFEFEF，底栏底色仍是它）
    surface: '#F5F5F5',
    surfaceRaised: palette.surfaceWhite, // #FFFFFF
    surfaceSunken: '#E8E8E8',
    text: palette.textPrimary, // #2D2D2D
    textMain: palette.textMain, // #545454
    textSecondary: palette.textSecondary, // #494949
    textMuted: palette.textMuted, // #717171
    // 浅色下取近白（与 surface 同值 #F5F5F5 —— 面板内的 Divider 等于看不见，分隔靠间距）；
    // 分隔线 / 图表网格线 / 面板指示点都是一条极淡的线
    // （进度条底槽与进度环槽已拆到 progressTrack）
    divider: '#F5F5F5',
    icon: palette.iconDefault, // #2D2D2D
    iconMuted: palette.iconSecondary, // #494949
    brand: palette.brandPrimary, // #BE4B3E
    // 品牌色底上的**文字 / 图标**色：文字的白色统一取 #F0F0F0（表面白仍是纯白 #FFFFFF，两者分开）
    brandOn: '#F0F0F0',
    accentYellow: palette.brandSecondary, // #EEB266
    accentBlue: palette.brandComplementary, // #466EAA
    accentRed: '#C0392B', // 深红，与浅色底对比度 ≈ 5.6:1
    // 浅色底上是一条纯白描边（深色模式取 #3A3A3A）
    border: '#FFFFFF',
    // 进度条底槽（独立参数，取与 border 相同的值）
    progressTrack: '#FFFFFF',
    // 底栏这一层 = 不透明实底（取 palette.surfaceContent #EFEFEF，比面板 surface #F5F5F5 深一档），
    // 条带里的图标 / 标签完全不透明
    barBackground: palette.surfaceContent,
    // 反向面板底：浅色模式取深色 surface（深色圆片），文字 / 图标随之取白
    surfaceInvert: '#1C1C1C',
    surfaceInvertOn: palette.invert, // #F5F5F5
  },
  dark: {
    bg: '#121212',
    surface: '#1C1C1C',
    // 抬升面（深色下唯一比面板更亮的一档：浮层 / 白底圆钮等）
    surfaceRaised: '#262626',
    surfaceSunken: '#0D0D0D',
    text: '#F5F5F5',
    textMain: '#E0E0E0',
    textSecondary: '#D4D4D4',
    textMuted: '#A8A8A8',
    divider: '#3A3A3A',
    icon: '#F5F5F5',
    iconMuted: '#C9C9C9',
    // 品牌红在深色底上要提亮：色相与浅色 `brandPrimary`(#BE4B3E) 同源，沿「加白」方向取到
    // 与面板底 #1C1C1C 的对比度 4.50:1（原 #D95752 只有 4.41，本次一并修正）
    brand: '#C8675C',
    brandOn: '#F0F0F0', // 文字的白色统一为 #F0F0F0（仅文字 / 图标，表面白不动）
    accentYellow: palette.brandSecondary,
    accentBlue: '#6C93C9',
    accentRed: '#F0736A', // 提亮红，与深色底对比度 ≈ 6.5:1
    // 深色底上的发丝线取深灰（与 divider 同值），不再用近白高亮描边
    border: '#3A3A3A',
    // 进度条底槽（独立参数，取与 border 相同的值）
    progressTrack: '#3A3A3A',
    // 底栏条带与面板同底
    barBackground: '#1C1C1C',
    // 反向面板底：深色模式取浅色 surface（浅色圆片），文字 / 图标随之取黑
    surfaceInvert: palette.surfaceContent, // #EFEFEF
    surfaceInvertOn: palette.textPrimary, // #2D2D2D
  },
};

/** 高对比度辅助模式覆盖（FR-O-2 辅助模式 → 高对比度） */
export const highContrastOverrides: Record<ColorSchemeName, Partial<SemanticColors>> = {
  light: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    text: '#000000',
    textMain: '#3D3D3D',
    textSecondary: '#1A1A1A',
    textMuted: '#333333',
    divider: '#767676',
    icon: '#000000',
    iconMuted: '#1A1A1A',
    // 品牌红在白底上要压暗：色相与主色同源，取到 7.08:1（AA 小字要求 4.5、AAA 要求 7）
    brand: '#963B31',
    barBackground: '#FFFFFF',
    // 高对比度浅色下 bg / surface 都是 #FFFFFF，白描边（#FFFFFF）会完全消失 → 统一改用黑色
    border: '#000000',
    progressTrack: '#000000',
    surfaceInvert: '#000000',
    surfaceInvertOn: '#F0F0F0',
  },
  dark: {
    bg: '#000000',
    surface: '#000000',
    surfaceRaised: '#111111',
    text: '#F0F0F0',
    textMain: '#E8E8E8',
    textSecondary: '#F0F0F0',
    textMuted: '#D0D0D0',
    divider: '#9A9A9A',
    icon: '#F0F0F0',
    iconMuted: '#F0F0F0',
    // 品牌红在纯黑底上要提亮：色相与主色同源，取到 7.01:1
    brand: '#D17F76',
    // 高对比度深色下底色为纯黑，外描边取高反差灰（与 divider 同值）
    border: '#9A9A9A',
    progressTrack: '#9A9A9A',
    barBackground: '#000000',
    surfaceInvert: '#FFFFFF',
    surfaceInvertOn: '#000000',
  },
};
