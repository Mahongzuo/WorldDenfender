/**
 * 关卡编辑器 Actor 撤销栈：每关卡最多保留 10 步。
 */
export var MAX_ACTOR_UNDO = 10;

/** @type {Record<string, object[][]>} */
var stacks = {};
var applying = false;

export function setUndoApplying(value) {
    applying = !!value;
}

export function isUndoApplying() {
    return applying;
}

/**
 * @param {string} levelId
 * @param {object[]} actors
 */
export function pushActorUndoSnapshot(levelId, actors) {
    if (applying || !levelId) return;
    if (!stacks[levelId]) stacks[levelId] = [];
    var stack = stacks[levelId];
    stack.push(JSON.parse(JSON.stringify(actors || [])));
    while (stack.length > MAX_ACTOR_UNDO) stack.shift();
}

/**
 * @param {string} levelId
 * @returns {object[]|null}
 */
export function popActorUndoSnapshot(levelId) {
    var stack = stacks[levelId];
    if (!stack || !stack.length) return null;
    return stack.pop();
}

export function clearActorUndoStack(levelId) {
    if (!levelId) return;
    delete stacks[levelId];
}
