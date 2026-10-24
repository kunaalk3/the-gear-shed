export function splitSqlStatements(contents) {
  const statements = [];
  let statementStart = 0;
  let index = 0;
  let state = "normal";
  let dollarQuote = "";
  let blockCommentDepth = 0;

  while (index < contents.length) {
    const current = contents[index];
    const next = contents[index + 1];

    if (state === "line-comment") {
      if (current === "\n") state = "normal";
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (current === "/" && next === "*") {
        blockCommentDepth += 1;
        index += 2;
      } else if (current === "*" && next === "/") {
        blockCommentDepth -= 1;
        index += 2;
        if (blockCommentDepth === 0) state = "normal";
      } else {
        index += 1;
      }
      continue;
    }

    if (state === "single-quoted") {
      if (current === "'" && next === "'") {
        index += 2;
      } else if (current === "'") {
        state = "normal";
        index += 1;
      } else {
        index += 1;
      }
      continue;
    }

    if (state === "double-quoted") {
      if (current === '"' && next === '"') {
        index += 2;
      } else if (current === '"') {
        state = "normal";
        index += 1;
      } else {
        index += 1;
      }
      continue;
    }

    if (current === "-" && next === "-") {
      state = "line-comment";
      index += 2;
    } else if (current === "/" && next === "*") {
      state = "block-comment";
      blockCommentDepth = 1;
      index += 2;
    } else if (current === "'") {
      state = "single-quoted";
      index += 1;
    } else if (current === '"') {
      state = "double-quoted";
      index += 1;
    } else if (current === "$") {
      const delimiter = contents.slice(index).match(/^\$(?:[a-zA-Z_][\w]*)?\$/)?.[0];
      if (delimiter) {
        dollarQuote = delimiter;
        state = "dollar-quoted";
        index += delimiter.length;
      } else {
        index += 1;
      }
    } else if (current === ";") {
      const statement = contents.slice(statementStart, index).trim();
      if (statement) statements.push(statement);
      statementStart = index + 1;
      index += 1;
    } else {
      index += 1;
    }

    if (state === "dollar-quoted") {
      const closingIndex = contents.indexOf(dollarQuote, index);
      if (closingIndex === -1) {
        throw new Error(`Unterminated dollar-quoted SQL block (${dollarQuote}).`);
      } else {
        index = closingIndex + dollarQuote.length;
        state = "normal";
      }
    }
  }

  if (state !== "normal" && state !== "line-comment") {
    throw new Error(`Unterminated SQL ${state} section.`);
  }

  const trailingStatement = contents.slice(statementStart).trim();
  if (trailingStatement) statements.push(trailingStatement);
  return statements;
}
