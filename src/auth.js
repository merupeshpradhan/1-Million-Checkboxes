const jwt = require("jsonwebtoken");

function generateToken(user) {
  // This creates a secure token with the user's GitHub ID
  return jwt.sign(
    { id: user.id, username: user.login },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { generateToken, verifyToken };
