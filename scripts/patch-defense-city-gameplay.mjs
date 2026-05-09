/**
 * 将五城 tower/enemy 地域化文案与「攻城强度」占位写入 Web/data/level-editor-state.json
 * （stats.attack 仅供编辑器可读；运行时攻城由 Enemy.towerSiegeDps）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, "..", "Web", "data", "level-editor-state.json");

/** @type {Record<string, { enemies: Record<string, { name: string; summary: string; attack?: number }>; towers: Record<string, { name: string; summary: string }> }>} */
const PACKS = {
  北京: {
    enemies: {
      basic: { name: "炭火烤鸭机甲", summary: "主力地面单位；靠近道路时炙烤己方塔。", attack: 11 },
      scout: { name: "胡同豆汁儿飞艇", summary: "极快掠过；低空溅射骚扰塔耐久。", attack: 7 },
      hacker: {
        name: "798 直播干扰球",
        summary: "远程弹幕洗塔——高射程投掷/干扰代表兵种。",
        attack: 32,
      },
      tank: { name: "故宫墙盾车", summary: "重装慢推；近战攻城压制门神格。", attack: 15 },
      swarm: { name: "庙会糖葫芦蜂群", summary: "数量堆叠的持续磨塔压力。", attack: 9 },
    },
    towers: {
      machine: { name: "大裤衩·玻璃棱阵", summary: "对应机枪塔骨架；帝都玻璃肌理皮肤位。" },
      cannon: { name: "鸟巢·钢环重炮", summary: "范围炮火；可加场馆桁架替换模型。" },
      frost: { name: "什刹海·冰面减速塔", summary: "减速控制；冰水混合特效位。" },
      mine: { name: "长城砖·感应雷", summary: "道路引爆装置；史实砖纹贴图友好。" },
      beacon: { name: "钟鼓楼·谐振信标", summary: "攻速增益核心；打点脉冲灯效。" },
      stellar: { name: "天坛星轨·棱镜", summary: "S 法术棱镜占位；可加祈年殿剪影。" },
      qinqiong: { name: "正阳门神·秦琼", summary: "门神阻挡；可与城门资产绑定。" },
      liqingzhao: { name: "御河词牌·漱玉", summary: "远程群体水墨风占位。" },
      bianque: { name: "太医院·青囊", summary: "治疗／毒反流；中医院场景扩展。" },
    },
  },
  上海: {
    enemies: {
      basic: { name: "生煎包蒸汽团", summary: "蒸汽云持续熏塔。", attack: 11 },
      scout: { name: "外卖骑手机车怪", summary: "高机动走位；侧翼磨血。", attack: 7 },
      hacker: { name: "陆家嘴量化幽灵", summary: "跨浦江洗射塔位。", attack: 32 },
      tank: { name: "石库门铁栅门", summary: "厚甲推进；强攻前排。", attack: 15 },
      swarm: { name: "小笼包皮塔群", summary: "密集层叠的持续压塔。", attack: 9 },
    },
    towers: {
      machine: { name: "外滩钟楼·加特林廊", summary: "沿河速射阵列。" },
      cannon: { name: "杨浦大桥·桁架炮", summary: "大桥抛物线炮火皮肤位。" },
      frost: { name: "苏州河·潮汐霜塔", summary: "河道冷凝减速。" },
      mine: { name: "里弄石板·瓦斯雷", summary: "窄巷伏击雷。" },
      beacon: { name: "东方明珠脉冲信标", summary: "球体三色谐振占位。" },
      stellar: { name: "环贸棱光·魔都 S", summary: "商场镭射顶棚扩展。" },
      qinqiong: { name: "石库门门将·忠义", summary: "里弄口盾墙人设。" },
      liqingzhao: { name: "申报馆·墨色潮", summary: "字林西报墨色弹幕。" },
      bianque: { name: "仁济堂·神医针", summary: "租界医疗哥特扩展。" },
    },
  },
  "440100": {
    enemies: {
      basic: { name: "双皮奶茶柱团", summary: "奶香蒸汽磨塔。", attack: 11 },
      scout: { name: "茶楼早点无人机", summary: "低空穿梭。", attack: 7 },
      hacker: { name: "珠江新城 LED 爬虫", summary: "超远洗屏弹幕。", attack: 32 },
      tank: { name: "骑楼砖碉堡", summary: "慢速强攻。", attack: 15 },
      swarm: { name: "肠粉蒸汽云", summary: "连片压迫。", attack: 9 },
    },
    towers: {
      machine: { name: "花城大道·榕树机枪", summary: "树下速射炮台。" },
      cannon: { name: "蛮腰塔焰火炮", summary: "小蛮腰焰火主题皮肤位。" },
      frost: { name: "白云骤雨冷凝塔", summary: "岭南暴雨减速。" },
      mine: { name: "茶位费·蒸笼雷", summary: "茶楼蒸笼陷阱。" },
      beacon: { name: "海珠桥谐振灯塔", summary: "江桥律动增幅。" },
      stellar: { name: "广交会射灯·星辰", summary: "会展射灯法系皮肤。" },
      qinqiong: { name: "岭南门楼·忠义像", summary: "宗祠门神像。" },
      liqingzhao: { name: "珠江夜雨·词句潮", summary: "夜雨墨色群攻。" },
      bianque: { name: "凉茶铺·神医柜", summary: "草药瓶塔皮肤。" },
    },
  },
  "440300": {
    enemies: {
      basic: { name: "科技园加班盒", summary: "持续输出磨塔。", attack: 11 },
      scout: { name: "低空物流穿越机", summary: "疾速点对点骚扰。", attack: 7 },
      hacker: { name: "南山 VPN 爬虫", summary: "跨园区远程洗塔。", attack: 32 },
      tank: { name: "工地塔吊盾蜥", summary: "盾甲推进。", attack: 15 },
      swarm: { name: "创客咖啡杯阵列", summary: "密集阵列压力。", attack: 9 },
    },
    towers: {
      machine: { name: "南山芯片·阵列枪", summary: "贴片机枪科幻皮。" },
      cannon: { name: "人才公园·镭射榴弹", summary: "滨海抛物爆破。" },
      frost: { name: "滨海冷凝·海风塔", summary: "海雾冷凝减速。" },
      mine: { name: "地铁施工·警戒雷", summary: "工地警示爆破。" },
      beacon: { name: "5G 小基站·功放", summary: "小基站阵列增益皮。" },
      stellar: { name: "湾区别墅·镭射天河", summary: "别墅天际线法系皮。" },
      qinqiong: { name: "海关大楼·守护神", summary: "口岸门神像。" },
      liqingzhao: { name: "湾区墨色·潮汐诗", summary: "墨色潮水群攻主题。" },
      bianque: { name: "互联网医院·青囊 AI", summary: "云端诊疗塔皮。" },
    },
  },
  "370100": {
    enemies: {
      basic: { name: "把子肉热浪团", summary: "热浪贴脸磨塔。", attack: 11 },
      scout: { name: "趵突飞泉蝌蚪", summary: "泉眼跃迁骚扰。", attack: 7 },
      hacker: { name: "泉标 Wi-Fi 水母", summary: "高空信号雨洗远端塔。", attack: 32 },
      tank: { name: "黑虎泉铁闸蟹", summary: "厚壳强攻。", attack: 15 },
      swarm: { name: "油旋饼旋涡群", summary: "旋涡阵列磨血。", attack: 9 },
    },
    towers: {
      machine: { name: "泉城广场·七十二泉眼阵", summary: "泉眼脉冲速射阵列。" },
      cannon: { name: "四门塔古刹榴弹", summary: "古刹抛物炮皮。" },
      frost: { name: "千佛山雪线凝霜", summary: "山脊冰霜减速塔。" },
      mine: { name: "泉港栈桥感应雷", summary: "栈桥潮汐陷阱。" },
      beacon: { name: "解放阁谐振信标", summary: "古城阁脉冲增幅。" },
      stellar: { name: "明湖夜游·珠光棱镜", summary: "夜游船灯法系皮。" },
      qinqiong: { name: "护城河门神", summary: "护城河水口盾墙人设。" },
      liqingzhao: { name: "易安乐府·潮汐", summary: "二安词句墨潮占位。" },
      bianque: { name: "华佗庙·神医塔", summary: "针灸神医塔占位。" },
    },
  },
};

function applyPack(cfg, pack) {
  if (!cfg || !pack) return 0;
  let n = 0;
  for (const row of cfg.enemies || []) {
    const patch = pack.enemies[row.id];
    if (patch) {
      row.name = patch.name;
      row.summary = patch.summary;
      row.stats = row.stats && typeof row.stats === "object" ? row.stats : {};
      if (patch.attack != null) row.stats.attack = patch.attack;
      n += 1;
    }
  }
  for (const row of cfg.towers || []) {
    const patch = pack.towers[row.id];
    if (patch) {
      row.name = patch.name;
      row.summary = patch.summary;
      n += 1;
    }
  }
  return n;
}

const raw = fs.readFileSync(jsonPath, "utf8");
const data = JSON.parse(raw);
let total = 0;
for (const key of Object.keys(PACKS)) {
  total += applyPack(data.cityGameplayConfigs[key], PACKS[key]);
}
fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`patched gameplay entries: ${total}, cities: ${Object.keys(PACKS).join(", ")}`);
