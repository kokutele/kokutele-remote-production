module.exports = function (app) {
  app.use(function (req, res, next) {
    //  res.setHeader("Feature-Policy", "display-capture 'self'");
    next();
  });
};