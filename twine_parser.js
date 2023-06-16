// Refer to https://www.motoslave.net/sugarcube/2/docs/
// -
// Probably not the best or most readable code, but frankly I'm surprised it works

function peek(string, index, word) {
    return word === string.slice(index, index + word.length);
}

export function parse(text) {
    let tokens = [];
    let bufferedToken = { type: "text", content: "", stage: null };

    function flushBuffer() {
        let buf = { ...bufferedToken };
        if (!buf.content) delete buf.content;
        delete buf.stage;

        if (buf.type !== "text" || buf.content) {
            tokens.push(buf);
        }
        bufferedToken = { type: "text", content: "", stage: null };
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (peek(text, i, "<<set")) {
            i += 4;
            flushBuffer();
            bufferedToken.type = "set";
            continue;
        } else if (peek(text, i, "<<if")) {
            i += 3;
            flushBuffer();
            bufferedToken.type = "if";
            continue;
        } else if (peek(text, i, "<<include")) {
            i += 8;
            flushBuffer();
            bufferedToken.type = "include";
            continue;
        } else if (peek(text, i, "<<else>>")) {
            i += 7;
            flushBuffer();
            bufferedToken.type = "else";
            flushBuffer();
            continue;
        } else if (peek(text, i, "<<endif>>")) {
            i += 8;
            flushBuffer();
            bufferedToken.type = "endif";
            flushBuffer();
            continue;
        }

        if (char === ">" && char === nextChar) {
            if (bufferedToken.type === "set") {
                let [varName, varValue] = bufferedToken.content.replaceAll(" ", "").split("=");
                delete bufferedToken.content;
                bufferedToken.varName = varName;
                bufferedToken.varValue = varValue;
                flushBuffer();
                i++;
                continue;
            } else if (bufferedToken.type === "if") {
                bufferedToken.condition = bufferedToken.content.trim();
                delete bufferedToken.content;
                flushBuffer();
                i++;
                continue;
            } else if (bufferedToken.type === "include") {
                bufferedToken.passage = bufferedToken.content.replaceAll('"', "").trim();
                delete bufferedToken.content;
                flushBuffer();
                i++;
                continue;
            } else {
                // console.warn("Uhhh");
            }
        }

        if (char === "[" && char === nextChar) {
            if (bufferedToken.type !== "text") console.warn("Bad things afoot!");
            i++;
            flushBuffer();
            bufferedToken.type = "link";
            bufferedToken.stage = "text";
            continue;
        }

        if (bufferedToken.type === "link") {
            if (char === "|") {
                if (bufferedToken.stage === "url") console.warn("What");
                bufferedToken.linkText = bufferedToken.content;
                bufferedToken.url = "";
                bufferedToken.stage = "url";
                bufferedToken.content = "";
                continue;
            }

            if (char === "]" && char === nextChar) {
                if (bufferedToken.stage !== "url") {
                    console.warn("No url?");
                }
                bufferedToken.url = bufferedToken.content;
                delete bufferedToken.content;
                flushBuffer();
                i++;
                continue;
            }
        }

        bufferedToken.content += char;
    }

    return tokens;
}