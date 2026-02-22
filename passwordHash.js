const bcrypt = require("bcrypt");

const plainPassword = "1";

bcrypt.hash(plainPassword, 10).then(hash => {
    console.log("Your Hash:", hash)
})