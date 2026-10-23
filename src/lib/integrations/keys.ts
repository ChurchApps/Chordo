// due to this being open source, there is no easy way to hide the API keys (that I know of),
// so this is a basic encryption to hide it from scrapers
// you could easily find the keys, but please don't do that, thanks! :)
// you are not allowed to used these keys outside of Chordo!
// (they are all free, so you can just get your own keys if you want)

export function getKey(type: string) {
    if (type === "pco_id") return "0685ecf610f6f48c9cc3213f5b8c7992422507fdbc3e8235914cc318d3c8a48c"
    if (type === "churchApps_id") return decrypt("110250560d5b4509545f1d")
    if (type === "churchApps_secret") return decrypt("3b536d0a132827205f725d2276342d23330e40540c204d0a00242d1753432f29")
    return "0e134712140b120c57400a09400e1c01100655490b1440071b1b"
}

const k = "df4fuowo89"
const decrypt = (v: string) => Array.from({ length: v.length / 2 }, (_, i) => String.fromCharCode(parseInt(v.substring(i * 2, i * 2 + 2), 16) ^ k.charCodeAt(i % k.length))).join("")
// const encrypt = (text) => Array.from(text, (char, i) => ('0' + (char.charCodeAt(0) ^ k.charCodeAt(i % k.length)).toString(16)).slice(-2)).join('');
