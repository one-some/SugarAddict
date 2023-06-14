function peek(string, index, word) {
  return word === string.slice(index, index + word.length);
}

export function parse(text) {
  let out = [];
  let _buf = { type: "text", content: "", stage: null };

  function flushBuffer() {
    let buf = { ..._buf };
    if (!buf.content) delete buf.content;
    delete buf.stage;

    if (buf.type !== "text" || buf.content) {
      out.push(buf);
    }
    _buf = { type: "text", content: "", stage: null };
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (peek(text, i, "<<set")) {
      i += 4;
      flushBuffer();
      _buf.type = "set";
      continue;
    } else if (peek(text, i, "<<if")) {
      i += 3;
      flushBuffer();
      _buf.type = "if";
      continue;
    } else if (peek(text, i, "<<include")) {
      i += 8;
      flushBuffer();
      _buf.type = "include";
      continue;
    } else if (peek(text, i, "<<else>>")) {
      i += 7;
      flushBuffer();
      _buf.type = "else";
      flushBuffer();
      continue;
    } else if (peek(text, i, "<<endif>>")) {
      i += 8;
      flushBuffer();
      _buf.type = "endif";
      flushBuffer();
      continue;
    }

    if (char === ">" && char === nextChar) {
      if (_buf.type === "set") {
        let [varName, varValue] = _buf.content.replaceAll(" ", "").split("=");
        delete _buf.content;
        _buf.varName = varName;
        _buf.varValue = varValue;
        flushBuffer();
        i++;
        continue;
      } else if (_buf.type === "if") {
        _buf.condition = _buf.content.trim();
        delete _buf.content;
        flushBuffer();
        i++;
        continue;
      } else if (_buf.type === "include") {
        _buf.passage = _buf.content.replaceAll('"', "").trim();
        delete _buf.content;
        flushBuffer();
        i++;
        continue;
      } else {
        console.warn("Uhhh");
      }
    }

    if (char === "[" && char === nextChar) {
      if (_buf.type !== "text") console.warn("Bad things afoot!");
      i++;
      flushBuffer();
      _buf.type = "link";
      _buf.stage = "text";
      continue;
    }

    if (_buf.type === "link") {
      if (char === "|") {
        console.log("HOO");
        if (_buf.stage === "url") console.warn("What");
        _buf.linkText = _buf.content;
        _buf.url = "";
        _buf.stage = "url";
        _buf.content = "";
        continue;
      }

      if (char === "]" && char === nextChar) {
        if (_buf.stage !== "url") {
          console.warn("No url?");
        }
        _buf.url = _buf.content;
        delete _buf.content;
        flushBuffer();
        i++;
        continue;
      }
    }

    _buf.content += char;
  }

  return out;
}

// reconstruct

function reconstructPassage(tokens) {
  out = "";
  for (const token of tokens) {
    switch (token.type) {
      case "text":
        out += token.content;
        break;
      case "link":
        if (token.linkText) {
          out += `[[${token.linkText}|${token.url}]]`;
        } else {
          out += `[[${token.url}]]`;
        }
        break;
      case "set":
        out += `<<set ${token.varName} = ${token.varValue}>>`;
        break;
      case "if":
        out += `<<if ${token.condition}>>`;
        break;
      case "include":
        out += `<<include "${token.passage}">>`;
        break;
      case "endif":
      case "else":
        out += `<<${token.type}>>`;
        break;
      default:
        console.warn("??", token.type);
    }
  }
  return out;
}
