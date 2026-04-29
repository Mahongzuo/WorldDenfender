/**
 * Incremental replacements for ASCII "?" placeholders in tower-defense-game.ts.
 * Uses only single-quoted / concatenated OLD strings — no stray `${` in Node templates.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "src", "game", "tower-defense-game.ts");

let c = fs.readFileSync(filePath, "utf8");

c = c
  .split('"?????????????????? API"')
  .join('"\\u6a21\\u578b\\u5df2\\u5e94\\u7528\\uff0c\\u4f46\\u5f53\\u524d\\u670d\\u52a1\\u5668\\u672a\\u542f\\u7528\\u6301\\u4e45\\u5316 API"');

function O(oldStr, newStr, label = "") {
  const n = c.split(oldStr).length - 1;
  if (n !== 1) {
    console.error(label || oldStr.slice(0, 80));
    console.error("Expected 1, got:", n);
    process.exit(1);
  }
  c = c.split(oldStr).join(newStr);
}

O("${spec.key} ? ${spec.name}", "${spec.key} \\u00b7 ${spec.name}", "spec key/name");
O('spec.rank + "? "', 'spec.rank + "\\u7ea7 "', "rank");
O('<div class="s-badge">??</div>', '<div class="s-badge">\\u7ec8\\u6781</div>', "badge");

O('const label = dark ? "????" : "????";', 'const label = dark ? "\\u6d45\\u8272\\u6a21\\u5f0f" : "\\u6df1\\u8272\\u6a21\\u5f0f";', "theme label");
O('const title = dark ? "???????" : "???????";', 'const title = dark ? "\\u5207\\u6362\\u4e3a\\u6d45\\u8272\\u754c\\u9762" : "\\u5207\\u6362\\u4e3a\\u6df1\\u8272\\u754c\\u9762";', "theme title");

O('this.showToast("??????", true);', 'this.showToast("\\u65b0\\u6e38\\u620f\\u5df2\\u5f00\\u59cb", true);');
O('this.showToast("???????????????");', 'this.showToast("\\u542f\\u52a8\\u65b0\\u6e38\\u620f\\u5931\\u8d25\\uff0c\\u8bf7\\u67e5\\u770b\\u63a7\\u5236\\u53f0\\u3002");');

O(
  "    if (showFeedback) {\n      this.showToast(\"?????\");\n    }",
  "    if (showFeedback) {\n      this.showToast(\"\\u5b58\\u6863\\u5df2\\u4fdd\\u5b58\");\n    }",
);

O('        this.showToast("????????");', '        this.showToast("\\u6ca1\\u6709\\u53ef\\u8bfb\\u53d6\\u7684\\u5b58\\u6863");');

O(
  "      this.resumeGame();\n      this.showToast(\"??????\");\n    } catch {\n      this.showToast(\"??????\");",
  "      this.resumeGame();\n      this.showToast(\"\\u5b58\\u6863\\u8bfb\\u53d6\\u5b8c\\u6210\");\n    } catch {\n      this.showToast(\"\\u5b58\\u6863\\u8bfb\\u53d6\\u5931\\u8d25\");",
);

O(
  'url.includes("RobotExpressive") ? "??? three.js ??????" : "?????????"',
  'url.includes("RobotExpressive") ? "\\u5df2\\u8f7d\\u5165 three.js \\u5b98\\u65b9\\u63a2\\u7d22\\u89d2\\u8272" : "\\u5df2\\u8f7d\\u5165\\u63a2\\u7d22\\u89d2\\u8272\\u6a21\\u578b"',
);

O(
  '    this.showToast("??????????????????");\n',
  '    this.showToast("\\u9ed8\\u8ba4\\u89d2\\u8272\\u52a0\\u8f7d\\u5931\\u8d25\\uff0c\\u5df2\\u4f7f\\u7528\\u5907\\u7528\\u65b9\\u5757\\u6a21\\u578b");\n',
);

O(
  '      this.showToast("??? .glb?.gltf ? .obj ????");',
  '      this.showToast("\\u8bf7\\u4e0a\\u4f20 .glb\\u3001.gltf \\u6216 .obj \\u6a21\\u578b\\u6587\\u4ef6");',
);

O(
  '      this.showToast(error instanceof Error ? error.message : "??????");',
  '      this.showToast(error instanceof Error ? error.message : "\\u6a21\\u578b\\u52a0\\u8f7d\\u5931\\u8d25");',
);

O(
  '        this.showToast(`??????${type}`);',
  '        this.showToast(`\\u5df2\\u66ff\\u6362\\u52a8\\u753b\\uff1a${type}`);',
);

O(
  "      } else {\n        this.showToast(\"??????????\");\n      }",
  "      } else {\n        this.showToast(\"\\u8be5\\u6587\\u4ef6\\u672a\\u5305\\u542b\\u6709\\u6548\\u52a8\\u753b\");\n      }",
);

O(
  "      }\n    } catch {\n      this.showToast(\"??????\");\n    }\n  }\n\n  private async parseModelData(name: string, data: ArrayBuffer): Promise<THREE.Group> {",
  "      }\n    } catch {\n      this.showToast(\"\\u52a8\\u753b\\u52a0\\u8f7d\\u5931\\u8d25\");\n    }\n  }\n\n  private async parseModelData(name: string, data: ArrayBuffer): Promise<THREE.Group> {",
);

O(
  'this.showToast(`??? ${importedCount} ??????`);',
  'this.showToast(`\\u5df2\\u540c\\u6b65 ${importedCount} \\u4e2a\\u7f16\\u8f91\\u5668\\u5173\\u5361`);',
);

O(
  "    } catch (error) {\n      console.warn(\"[LevelEditorRuntime] failed to load editor maps\", error);\n      this.showToast(\"?????????????????\");",
  "    } catch (error) {\n      console.warn(\"[LevelEditorRuntime] failed to load editor maps\", error);\n      this.showToast(\"\\u672a\\u8bfb\\u53d6\\u5230\\u7f16\\u8f91\\u5668\\u5173\\u5361\\uff0c\\u5df2\\u4f7f\\u7528\\u5185\\u7f6e\\u5730\\u56fe\");",
);

O(
  "cityLabel.textContent = `${cityInfo.label} ? ${MAPS[cityInfo.defenseIndex].name}`",
  "cityLabel.textContent = `${cityInfo.label} \\u00b7 ${MAPS[cityInfo.defenseIndex].name}`",
);

O('this.showToast(`??????${map.name}`);', 'this.showToast(`\\u5df2\\u52a0\\u8f7d\\u5730\\u56fe\\uff1a${map.name}`);');
O('this.showToast(`????????${map.name}`);', 'this.showToast(`\\u5df2\\u8fdb\\u5165\\u63a2\\u7d22\\u5730\\u56fe\\uff1a${map.name}`);');

O(
  'this.showToast("S ?????????????????");',
  'this.showToast("S \\u7ea7\\u9632\\u5fa1\\u5854\\u5c1a\\u672a\\u89e3\\u9501\\uff0c\\u8bf7\\u5148\\u6253\\u5f00\\u8865\\u7ed9\\u62bd\\u5361");',
);

O(
  '? "??????????????" : "???????????"',
  '? "\\u81ea\\u7531\\u63a2\\u7d22\\uff1a\\u6218\\u7ebf\\u5728\\u540e\\u53f0\\u7ee7\\u7eed\\u63a8\\u8fdb" : "\\u5854\\u9632\\u6a21\\u5f0f\\uff1a\\u56de\\u5230\\u5b9e\\u65f6\\u6218\\u7ebf"',
);

O(
  "  private toggleCameraMode(): void {\n    if (this.mode === \"explore\") {\n      this.showToast(\"????????????????????\");\n      return;\n    }",
  "  private toggleCameraMode(): void {\n    if (this.mode === \"explore\") {\n      this.showToast(\"\\u63a2\\u7d22\\u6a21\\u5f0f\\u56fa\\u5b9a\\u7b2c\\u4e09\\u4eba\\u79f0\\u89c6\\u89d2\\uff0c\\u53ef\\u4f7f\\u7528\\u6eda\\u8f6e\\u7f29\\u653e\");\n      return;\n    }",
);

O(
  '    this.showToast(this.cameraMode === "topdown" ? "???????" : "???????");',
  '    this.showToast(this.cameraMode === "topdown" ? "\\u955c\\u5934\\uff1a\\u6218\\u672f\\u4fef\\u89c6" : "\\u955c\\u5934\\uff1a\\u659c\\u89c6\\u5de1\\u822a");',
);

O(
  '      this.showToast("??????????????");',
  '      this.showToast("\\u8bf7\\u5207\\u56de\\u5854\\u9632\\u6a21\\u5f0f\\u540e\\u518d\\u90e8\\u7f72\\u9632\\u5fa1\\u5854");',
);

O('this.showToast(`?????${spec.name}`);', 'this.showToast(`\\u5efa\\u9020\\u5b8c\\u6210\\uff1a${spec.name}`);');
O('this.showToast(`????${building.spec.name}`);', 'this.showToast(`\\u5df2\\u62c6\\u9664\\uff1a${building.spec.name}`);');

O('this.showToast(`????????? $${reward}`);', 'this.showToast(`\\u6ce2\\u6b21\\u6e05\\u7406\\u5b8c\\u6bd5\\uff0c\\u5956\\u52b1 $${reward}`);');

O('this.showToast(`? ${this.wave} ????`, true);', 'this.showToast(`\\u7b2c ${this.wave} \\u6ce2\\u5df2\\u5f00\\u59cb`, true);');

O('this.showToast("??????????? -1");', 'this.showToast("\\u654c\\u4eba\\u7a81\\u7834\\u9632\\u7ebf\\uff0c\\u57fa\\u5730\\u751f\\u547d -1");');
O(
  '          this.showToast("????????????", true);',
  '          this.showToast("\\u57fa\\u5730\\u88ab\\u653b\\u7834\\uff0c\\u6b63\\u5728\\u91cd\\u7f6e\\u5730\\u56fe", true);',
);

O(
  '        `${this.selectedBuilding.spec.activeSkill.name} ????${Math.ceil(this.selectedBuilding.skillCooldownTimer)}s`,',
  '        `${this.selectedBuilding.spec.activeSkill.name} \\u51b7\\u5374\\u4e2d\\uff1a${Math.ceil(this.selectedBuilding.skillCooldownTimer)}s`,',
);

O('this.showToast(`?????? ${hits} ???`);', 'this.showToast(`\\u661f\\u8f89\\u7206\\u88c2\\u547d\\u4e2d ${hits} \\u4e2a\\u654c\\u4eba`);');

O(
  "} else if (b.spec.id === \"qinqiong\") {\n      b.hp = Math.min(b.hp + 200, b.spec.maxHp ?? 1);\n      this.addExplosion(origin, 2 * TILE_SIZE, 0xd4af37);\n      this.showToast(\"????????????????????\");",
  "} else if (b.spec.id === \"qinqiong\") {\n      b.hp = Math.min(b.hp + 200, b.spec.maxHp ?? 1);\n      this.addExplosion(origin, 2 * TILE_SIZE, 0xd4af37);\n      this.showToast(\"\\u79e6\\u743c\\u65bd\\u653e\\u300c\\u4e0d\\u52a8\\u5982\\u5c71\\u300d\\uff0c\\u56de\\u590d\\u751f\\u547d\\u5e76\\u83b7\\u5f97\\u62a4\\u76fe\");",
);

O('this.showToast(`?????? ${hits} ????????`);', 'this.showToast(`\\u6f31\\u7389\\u6ce2\\u6f9c\\u547d\\u4e2d ${hits} \\u4e2a\\u654c\\u4eba\\u5e76\\u9644\\u52a0\\u51cf\\u901f`);');

O(
  '      this.showToast("?????????????????");\n    }\n\n    b.skillCooldownTimer = b.spec.activeSkill!.cooldown;',
  '      this.showToast("\\u6241\\u9e4a\\u65bd\\u653e\\u300c\\u8d77\\u6b7b\\u56de\\u751f\\u300d\\uff0c\\u7fa4\\u4f53\\u5927\\u5e45\\u6cbb\\u7597");\n    }\n\n    b.skillCooldownTimer = b.spec.activeSkill!.cooldown;',
);

O(
  'this.showToast(`[??] ??? ${b.spec.name}`);',
  'this.showToast(`[\\u9ed1\\u5ba2] \\u5df2\\u7628\\u75ea ${b.spec.name}`);',
);

O(
  '        this.showToast(`???? +$${drop.amount}??? 1 ???????`);',
  '        this.showToast(`\\u62fe\\u53d6\\u8d44\\u6e90 +$${drop.amount}\\uff0c\\u83b7\\u5f97 1 \\u5f20\\u7279\\u6d3e\\u8865\\u7ed9\\u5361\\uff01`);',
);

O(
  '      this.showToast(`?????? ${spawned} ?????`);',
  '      this.showToast(`\\u63a2\\u7d22\\u533a\\u5237\\u65b0\\u4e86 ${spawned} \\u4e2a\\u91d1\\u94b1\\u9053\\u5177`);',
);

O('      this.showToast(`????? $${amount}`);', '      this.showToast(`\\u5730\\u56fe\\u4e0a\\u6389\\u843d $${amount}`);');
O('        this.showToast(`???? +$${amount}`);', '        this.showToast(`\\u51fb\\u6740\\u6389\\u843d +$${amount}`);');

O(
  "    if (this.paused) {\n      this.showToast(\"?????\");\n    }",
  "    if (this.paused) {\n      this.showToast(\"\\u6e38\\u620f\\u5df2\\u6682\\u505c\");\n    }",
);

O(
  '      this.gachaResultElement.textContent = "??????????";\n      this.showToast("??????????");',
  '      this.gachaResultElement.textContent = "\\u5df2\\u65e0\\u53ef\\u7528\\u8865\\u7ed9\\u62bd\\u5361\\u6b21\\u6570";\n      this.showToast("\\u6682\\u65e0\\u53ef\\u7528\\u8865\\u7ed9\\u62bd\\u5361\\u6b21\\u6570");',
);

O(
  'this.gachaResultElement.innerHTML = `<span>??????</span><span>${draw.count} ?????</span>`;',
  'this.gachaResultElement.innerHTML = `<span>\\u73af\\u80fd\\u626b\\u63cf\\u4e2d\\u2026</span><span>${draw.count} \\u8fde\\u8865\\u7ed9\\u542f\\u52a8</span>`;',
);

O(
  '        this.showToast(`${pool.name}?S ???????????????`);',
  '        this.showToast(`${pool.name}\\uff1aS \\u7ea7\\u5e72\\u5458\\u5df2\\u89e3\\u9501\\uff0c\\u53ef\\u5728\\u5854\\u9632\\u5730\\u56fe\\u90e8\\u7f72`);',
);

fs.writeFileSync(filePath, c, "utf8");
console.log("OK:", filePath);
