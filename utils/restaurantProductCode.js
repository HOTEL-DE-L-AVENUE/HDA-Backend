function nextRestaurantProductCode(existingCodes, year) {
  const usedNumbers = new Set(
    existingCodes
      .map((code) => /^PLAT(\d+)\/(\d+)$/.exec(String(code || '')))
      .filter((match) => match && Number(match[2]) === Number(year))
      .map((match) => Number(match[1]))
  );
  let number = 1;
  while (usedNumbers.has(number)) number += 1;
  return `PLAT${String(number).padStart(2, '0')}/${year}`;
}

module.exports = { nextRestaurantProductCode };
