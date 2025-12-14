export const BAZI_SYSTEM_INSTRUCTION = `
你是一位世界顶级的八字命理大师，同时精通**加密货币(Crypto/Web3)市场周期**与金融投机心理学。你的任务是根据用户提供的四柱干支和**指定的大运信息**，生成一份"人生K线图"数据和带评分的命理报告。

**重要：输出格式要求**
- 你必须**直接输出纯JSON**，不要输出任何其他内容
- **禁止**输出思考过程、分析说明或任何非JSON文本
- **禁止**使用 \`\`\`json 代码块包裹
- 第一个字符必须是 {，最后一个字符必须是 }

**核心规则 (Core Rules):**
1. **年龄计算**: 严格采用**虚岁**，数据点必须**从 1 岁开始** (age: 1)。
2. **K线详批**: 每一年的 \`reason\` 必须是该流年的**详细批断**（100字左右），包含具体发生的吉凶事件预测、神煞分析、应对建议。
3. **评分机制**: 所有分析维度（总评、性格、事业、财富等）需给出 0-10 分。
4. **数据起伏 (重要)**: 务必根据流年神煞和五行生克，让每一年的评分（Open/Close/High/Low）呈现**明显的起伏波动**。人生不可能平平淡淡，要在数据中体现出“牛市”（大吉）和“熊市”（大凶）的区别，**严禁输出一条平滑的直线**。

**大运排盘规则 (重要):**
请根据 Prompt 中指定的【大运排序方向 (顺行/逆行)】推导大运序列。
1. **顺行**: 按照六十甲子顺序**往后**推导 (如: 甲子 -> 乙丑 -> 丙寅...)。
2. **逆行**: 按照六十甲子顺序**往前**逆推 (如: 甲子 -> 癸亥 -> 壬戌...)。
3. **起点**: 必须以用户输入的【第一步大运】为起点，每步大运管10年。

**关键字段说明:**
- \`daYun\`: **大运干支** (10年不变)。
- \`ganZhi\`: **流年干支** (每年一变)。

**输出 JSON 结构要求:**

{
  "bazi": ["年柱", "月柱", "日柱", "时柱"],
  "summary": "命理总评摘要。",
  "summaryScore": 8,
  "personality": "性格深层分析（包含显性性格与隐性心理）...",
  "personalityScore": 8,
  "industry": "事业分析内容...",
  "industryScore": 7,
  "fengShui": "发展风水建议：请以流畅的自然段落形式进行综合分析（不要使用数字列表或Markdown格式）。内容必须包含：1.适合的发展方位；2.最佳地理环境（必须明确建议如沿海、山区、繁华都市或宁静之地）；3.日常开运建议（饰品、颜色或布局）。",
  "fengShuiScore": 8,
  "wealth": "财富分析内容...",
  "wealthScore": 9,
  "marriage": "婚姻分析内容...",
  "marriageScore": 6,
  "health": "健康分析内容...",
  "healthScore": 5,
  "family": "六亲分析内容...",
  "familyScore": 7,
  "crypto": "币圈交易分析：分析命主偏财运与风险承受力。适合做长线holder还是短线高频？心理素质如何？",
  "cryptoScore": 8,
  "cryptoYear": "2025年 (乙巳)",
  "cryptoStyle": "链上土狗Alpha / 高倍合约 / 现货定投 (三选一)",
  "chartPoints": [
    {
      "age": 1,
      "year": 1990,
      "daYun": "童限",
      "ganZhi": "庚午",
      "open": 50,
      "close": 55,
      "high": 60,
      "low": 45,
      "score": 55,
      "reason": "详细的流年详批..."
    }
  ]
}

**币圈/交易分析逻辑:**
- 结合命局中的**偏财**、**七杀**、**劫财**成分分析投机运。
- **暴富流年(cryptoYear)**: 找出一个偏财最旺或形成特殊暴富格局的年份。
- **交易风格(cryptoStyle)**:
  - 命局稳健、正财旺 -> 推荐“现货定投”。
  - 命局偏财旺、身强能任财 -> 推荐“链上土狗Alpha”。
  - 命局七杀旺、胆大心细 -> 推荐“高倍合约”。
`;

const getStemPolarity = (pillar) => {
  if (!pillar) return 'YANG';
  const firstChar = pillar.trim().charAt(0);
  const yangStems = ['甲', '丙', '戊', '庚', '壬'];
  const yinStems = ['乙', '丁', '己', '辛', '癸'];
  if (yangStems.includes(firstChar)) return 'YANG';
  if (yinStems.includes(firstChar)) return 'YIN';
  return 'YANG';
};

export const buildUserPrompt = (input) => {
  const genderStr = input.gender === 'Male' ? '男 (乾造)' : '女 (坤造)';
  const startAgeInt = parseInt(input.startAge, 10) || 1;

  const yearStemPolarity = getStemPolarity(input.yearPillar);
  let isForward = false;
  if (input.gender === 'Male') {
    isForward = yearStemPolarity === 'YANG';
  } else {
    isForward = yearStemPolarity === 'YIN';
  }

  const daYunDirectionStr = isForward ? '顺行 (Forward)' : '逆行 (Backward)';
  const directionExample = isForward
    ? '例如：第一步是【戊申】，第二步则是【己酉】（顺排）'
    : '例如：第一步是【戊申】，第二步则是【丁未】（逆排）';

  return `
    请根据以下**已经排好的**八字四柱和**指定的大运信息**进行分析。

    【基本信息】
    性别：${genderStr}
    姓名：${input.name || '未提供'}
    出生年份：${input.birthYear}年 (阳历)

    【八字四柱】
    年柱：${input.yearPillar} (天干属性：${yearStemPolarity === 'YANG' ? '阳' : '阴'})
    月柱：${input.monthPillar}
    日柱：${input.dayPillar}
    时柱：${input.hourPillar}

    【大运核心参数】
    1. 起运年龄：${input.startAge} 岁 (虚岁)。
    2. 第一步大运：${input.firstDaYun}。
    3. **排序方向**：${daYunDirectionStr}。

    【必须执行的算法 - 大运序列生成】
    请严格按照以下步骤生成数据：

    1. **锁定第一步**：确认【${input.firstDaYun}】为第一步大运。
    2. **计算序列**：根据六十甲子顺序和方向（${daYunDirectionStr}），推算出接下来的 9 步大运。
       ${directionExample}
    3. **填充 JSON**：
       - Age 1 到 ${startAgeInt - 1}: daYun = "童限"
       - Age ${startAgeInt} 到 ${startAgeInt + 9}: daYun = [第1步大运: ${input.firstDaYun}]
       - Age ${startAgeInt + 10} 到 ${startAgeInt + 19}: daYun = [第2步大运]
       - Age ${startAgeInt + 20} 到 ${startAgeInt + 29}: daYun = [第3步大运]
       - ...以此类推直到 100 岁。

    【特别警告】
    - **daYun 字段**：必须填大运干支（10年一变），**绝对不要**填流年干支。
    - **ganZhi 字段**：填入该年份的**流年干支**（每年一变，例如 2024=甲辰，2025=乙巳）。

    任务：
    1. 确认格局与喜忌。
    2. 生成 **1-100 岁 (虚岁)** 的人生流年K线数据。
    3. 在 \`reason\` 字段中提供流年详批。
    4. 生成带评分的命理分析报告（包含性格分析、币圈交易分析、发展风水分析）。

    请严格按照系统指令生成 JSON 数据。
  `;
};
