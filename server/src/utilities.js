const uomContent = [
    {type: "uom", name: "EA", description: "Each", pluralDescription: "Eaches"},
    {type: "uom", name: "X2", description: "Bunch", pluralDescription: "Bunches"},
    {type: "uom", name: "OZ", description: "Ounce", pluralDescription: "Ounces"},
    {type: "uom", name: "FO", description: "Fluid Ounce", pluralDescription: "Fluid Ounces"},
    {type: "uom", name: "LB", description: "Pound", pluralDescription: "Pounds"},
    {type: "uom", name: "GA", description: "Gallon", pluralDescription: "Gallons"},
    {type: "uom", name: "GH", description: "Half Gallon", pluralDescription: "Half Gallons"},
    {type: "uom", name: "QT", description: "Quart", pluralDescription: "Quarts"},
    {type: "uom", name: "LT", description: "Liter", pluralDescription: "Liters"},
    {type: "uom", name: "ML", description: "Milliliter", pluralDescription: "Millileters"},
    {type: "uom", name: "KG", description: "Kilogram", pluralDescription: "Kilograms"},
    {type: "uom", name: "GR", description: "Gram", pluralDescription: "Grams"},
    {type: "uom", name: "BX", description: "Box", pluralDescription: "Boxes"},
    {type: "uom", name: "BO", description: "Bottle", pluralDescription: "Bottles"},
    {type: "uom", name: "CA", description: "Case", pluralDescription: "Cases"},
    {type: "uom", name: "CU", description: "Cup", pluralDescription: "Cups"},
    {type: "uom", name: "CT", description: "Carton", pluralDescription: "Cartons"},
    {type: "uom", name: "DZ", description: "Dozen", pluralDescription: "Dozen"},
    {type: "uom", name: "PC", description: "Piece", pluralDescription: "Pieces"},
    {type: "uom", name: "PK", description: "Package", pluralDescription: "Packages"},
    {type: "uom", name: "PT", description: "Pint", pluralDescription: "Pints"},
    {type: "uom", name: "RL", description: "Roll", pluralDescription: "Rolls"},
]

function emailPatternValidation(email) {
    const emailRegex=/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return emailRegex.test(email);
};

function usernamePatternValidation(username) {
    const usernameRegex=/^[a-zA-Z0-9]*$/
    return usernameRegex.test(username);
}

function fullnamePatternValidation(fullname) {
    const usernameRegex=/^[a-zA-Z0-9 ]*$/
    return usernameRegex.test(fullname);
}

module.exports = {
    emailPatternValidation,
    usernamePatternValidation,
    fullnamePatternValidation
}