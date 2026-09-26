main();

function main() {
  const humanPlayer = Player(0);
  if (humanPlayer) {
    DisplayTextToPlayer(humanPlayer, 0, 0, "Welcome! You face the W3 Warlord AI");
    throw new Error("Source-map test");
  }
}
