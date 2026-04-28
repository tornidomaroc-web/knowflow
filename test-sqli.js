const mysql = require('mysql');
const db = mysql.createConnection({});

function getUser(req, res) {
  const userId = req.body.id;
  db.query("SELECT * FROM users WHERE id = " + userId, (err, results) => {
    res.json(results);
  });
}
