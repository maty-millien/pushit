import color from "picocolors";

export function displayCommitMessage(message: string): void {
  const padding = 3;
  const boxWidth = message.length + padding * 2;

  const topBorder = `╭${"─".repeat(boxWidth)}╮`;
  const bottomBorder = `╰${"─".repeat(boxWidth)}╯`;
  const emptyLine = `│${" ".repeat(boxWidth)}│`;

  console.log();
  console.log(color.dim(topBorder));
  console.log(color.dim(emptyLine));
  console.log(
    color.dim("│") +
      " ".repeat(padding) +
      color.bold(color.cyan(message)) +
      " ".repeat(padding) +
      color.dim("│")
  );
  console.log(color.dim(emptyLine));
  console.log(color.dim(bottomBorder));
  console.log();
}
