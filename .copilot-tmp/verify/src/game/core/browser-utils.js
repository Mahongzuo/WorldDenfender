export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.byteLength; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }
    return window.btoa(binary);
}
export function setObjectOpacity(object, opacity) {
    const mats = object.material;
    if (mats) {
        const list = Array.isArray(mats) ? mats : [mats];
        for (const item of list) {
            item.transparent = true;
            item.opacity = opacity;
        }
    }
    for (const child of object.children) {
        setObjectOpacity(child, opacity);
    }
}
