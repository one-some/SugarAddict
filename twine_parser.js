// Refer to https://www.motoslave.net/sugarcube/2/docs/
// -
// Probably not the best or most readable code, but frankly I'm surprised it works

const STRING_CHARACTERS = [`'`, `"`];

function peek(string, index, word) {
    return word === string.slice(index, index + word.length);
}

export function parse(text) {
    let tokens = [];
    let bufferedToken = { type: "text", content: "", stage: null };
    let parseState = {
        inExpression: false,
        inString: false,
        stringPrimer: "",
    };

    function flushBuffer() {
        let buf = { ...bufferedToken };
        if (!buf.content) delete buf.content;
        delete buf.stage;

        if (buf.type !== "text" || buf.content) {
            tokens.push(buf);
        }

        bufferedToken = { type: "text", content: "", stage: null };
        parseState = { inExpression: false, inString: false };
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        // Generic token open (or close if its a whole token)
        let peekSuccess = false;
        for (const peekCandidate of [
            { matchText: "<<set", tokenType: "set", wholeToken: false, opensExpression: true },
            { matchText: "<<if", tokenType: "if", wholeToken: false },
            { matchText: "<<include", tokenType: "include", wholeToken: false },
            { matchText: "<<else>>", tokenType: "else", wholeToken: true },
            { matchText: "<<endif>>", tokenType: "endif", wholeToken: true },
            { matchText: "/%", tokenType: "comment", wholeToken: false },

        ]) {
            if (peek(text, i, peekCandidate.matchText)) {
                i += peekCandidate.matchText.length - 1;
                flushBuffer();
                bufferedToken.type = peekCandidate.tokenType;
                if (peekCandidate.wholeToken) flushBuffer();
                if (peekCandidate.opensExpression) parseState.inExpression = true;
                peekSuccess = true;
                break;
            }
        }
        if (peekSuccess) continue;

        // String stuff.
        // Is char a string primer char? Also, are we in an expression?
        if (STRING_CHARACTERS.includes(char) && parseState.inExpression) {
            // Are we already in a string?
            if (parseState.inString) {
                // If so, we may need to close it. Is this char the one that started the string?
                if (char === parseState.stringPrimer) {
                    parseState.inString = false;
                }
                // If it's not the primer character it's not our concern!
            } else {
                // If not, we need to open one
                parseState.inString = true;
                parseState.stringPrimer = char;
            }
        }

        // If we're in a string, don't bother parsing tokens
        if (parseState.inString) {
            bufferedToken.content += char;
            continue;
        }


        // Generic token close
        if (char === ">" && char === nextChar) {
            // BEWARE: Deletes bufferedToken.content
            let closeToken = true;

            if (bufferedToken.type === "set") {
                bufferedToken.assignments = {};
                for (const assignmentExpression of bufferedToken.content.split(",")) {
                    let varName, varValue;
                    // https://www.motoslave.net/sugarcube/2/docs/#macros-macro-set
                    if (assignmentExpression.includes("=")) {
                        // Using standard JavaScript operators
                        [varName, varValue] = assignmentExpression.replaceAll(" ", "").split("=");
                    } else {
                        // Using the TwineScript "to" operator
                        [varName, varValue] = assignmentExpression.split(" to ").map(x => x.replaceAll(" ", ""));
                    }

                    bufferedToken.assignments[varName] = varValue;

                }
            } else if (bufferedToken.type === "if") {
                bufferedToken.condition = bufferedToken.content.trim();
            } else if (bufferedToken.type === "include") {
                bufferedToken.passage = bufferedToken.content.replaceAll('"', "").trim();
            } else {
                closeToken = false;
                // console.warn("Uhhh");
            }

            if (closeToken) {
                delete bufferedToken.content;
                flushBuffer();
                i++;
                continue;
            }
        }

        // Close comment
        if (char === "%" && nextChar === "/") {
            bufferedToken.text = bufferedToken.content;
            delete bufferedToken.content;
            flushBuffer();
            i++;
            continue;
        }

        // Begin link
        if (char === "[" && char === nextChar) {
            if (bufferedToken.type !== "text") console.warn("Bad things afoot!");
            i++;
            flushBuffer();
            bufferedToken.type = "link";
            bufferedToken.stage = "text";
            continue;
        }

        if (bufferedToken.type === "link") {
            // Partition link
            if (char === "|") {
                if (bufferedToken.stage === "url") console.warn("What");
                bufferedToken.linkText = bufferedToken.content;
                bufferedToken.url = "";
                bufferedToken.stage = "url";
                bufferedToken.content = "";
                continue;
            }

            // Close link
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