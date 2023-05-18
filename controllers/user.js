const MESSAGE = require("../models/gpt");
const USER = require("../models/auth");
const EXTRA = require("../models/extrauser");
const CONVERSATION = require("../models/conversation");
const HttpError = require("../helper/HttpError");
const bcrypt = require("bcryptjs");

const createGpt = async (req, res, next) => {
  const openAi = req.app.get("gpt");
  const { extraId, message, messages, text, converId } = req.body;

  //console.log(message);

  //protect block
  let blockUser;
  try {
    blockUser = await USER.findOne({ extraId: extraId });
  } catch (err) {
    const errors = new HttpError("Find block user failed", 500);
    return next(errors);
  }
  if (blockUser?.block) {
    const errors = new HttpError("Sorry your account has been blocked", 500);
    return next(errors);
  }
  //protect block

  //protection
  let lmessages;
  if (!req.body.token) {
    try {
      lmessages = await MESSAGE.find({ userId: req.body.extraId });
    } catch (err) {
      console.log(err);
    }
    if (lmessages.length === 3) {
      const errors = new HttpError(
        "Login / Signup for free to send more messages.",
        500
      );
      return next(errors);
    }
  }
  //protection

  let dbData;

  try {
    dbData = await MESSAGE.find({
      $and: [{ userId: extraId }, { conversationId: converId }],
    });
  } catch (err) {
    console.log(err);
  }

  let extraData;

  try {
    extraData = await EXTRA.find({
      $and: [{ userId: extraId }, { conversationId: converId }],
    });
  } catch (err) {
    console.log(err);
  }

  let assistantData = dbData.map((item) => item.gpt);
  let userData = dbData.map((item) => item.user);
  let extraUserData = extraData.map((item) => item.user);
  //let assistantData = dbData.map((item) => item.gpt);

  const assisGpt = assistantData.toString() || " ";
  const userGpt = userData.toString() || " ";
  const extraUserGpt = extraUserData.toString() || " ";

  // console.log(userGpt + " mymessage");
  // console.log(extraUserGpt + " extramessage");
  openAi
    .createChatCompletion({
      model: "gpt-3.5-turbo",

      messages: [
        {
          role: "system",
          content:
            "You are AI physician chatbot and helpful assistance. You will provide any medical concerns information to the users based on their symptoms. And always try to answer smartly so that user can understand easily",
        },
        {
          role: "assistant",
          content: assisGpt,
        },

        {
          role: "user",
          content: userGpt,
        },
        {
          role: "user",
          content: extraUserGpt,
        },
        {
          role: "user",
          content: message,
        },
        {
          role: "user",
          content: text,
        },
      ],
    })
    .then((ress) => {
      //console.log(res.data.choices[0].message.content);
      res.status(200).json({ result: ress.data });
    })
    .catch((err) => {
      console.log(err);
    });
};

const getMessage = async (req, res) => {
  let message;

  try {
    message = await MESSAGE.find({
      $and: [
        { userId: req.body.userId },
        { conversationId: req.body.converId },
      ],
    });
  } catch (err) {
    console.log(err);
  }

  res.status(200).json({ result: message });
};

const createMessage = async (req, res, next) => {
  let message;

  //protect block
  let blockUser;
  try {
    blockUser = await USER.findOne({ extraId: req.body.userId });
  } catch (err) {
    const errors = new HttpError("Find block user failed", 500);
    return next(errors);
  }
  if (blockUser?.block) {
    const errors = new HttpError("Sorry your account has been blocked", 500);
    return next(errors);
  }
  //protect block

  if (!req.body.token) {
    let messages;

    try {
      messages = await MESSAGE.find({ userId: req.body.userId });
    } catch (err) {
      console.log(err);
    }

    if (messages.length === 3) {
      const errors = new HttpError(
        "Login / Signup for free to send more messages.",
        500
      );
      return next(errors);
    }
  }

  try {
    message = await MESSAGE.create(req.body);
  } catch (err) {
    const errors = new HttpError("create message failed", 500);
    return next(errors);
  }

  message.conversationId = req.body.converId;
  // console.log(req.body.converId);
  try {
    await message.save();
  } catch (err) {
    const errors = new HttpError("update message failed", 500);
    return next(errors);
  }

  res.status(200).json({ result: message });
};

const createConversation = async (req, res, next) => {
  let existingConver;
  //protect block
  let blockUser;
  try {
    blockUser = await USER.findOne({ extraId: req.body.userId });
  } catch (err) {
    const errors = new HttpError("Find block user failed", 500);
    return next(errors);
  }

  //protect block

  try {
    existingConver = await CONVERSATION.find({ userId: req.body.userId });
  } catch (err) {
    const errors = new HttpError("find conversation failed", 500);
    return next(errors);
  }
  if (existingConver.length === 8) {
    const errors = new HttpError(
      "Sorry you can't create more than eight conversation",
      500
    );
    return next(errors);
  }

  let createCon;
  if (existingConver.length === 0) {
    try {
      createCon = await CONVERSATION.create(req.body);
    } catch (err) {
      const errors = new HttpError("create conversation failed", 500);
      return next(errors);
    }
    res.status(200).json({ con: createCon._id });
  } else if (existingConver.length !== 0 && req.body.first) {
    try {
      createCon = await CONVERSATION.findOne({ userId: req.body.userId });
    } catch (err) {
      const errors = new HttpError("create conversation failed", 500);
      return next(errors);
    }
    res.status(200).json({ con: createCon._id });
  } else if (existingConver.length !== 0 && !req.body.token) {
    const errors = new HttpError(
      "You must need to Login/Signup to create multiple conversation",
      500
    );
    return next(errors);
  } else if (existingConver.length !== 0 && req.body.token) {
    if (blockUser.block) {
      const errors = new HttpError("Sorry your account has been blocked", 500);
      return next(errors);
    }
    try {
      createCon = await CONVERSATION.create(req.body);
    } catch (err) {
      const errors = new HttpError("create conversation failed", 500);
      return next(errors);
    }
    res.status(200).json({ con: createCon._id });
  }
};

const getConversation = async (req, res, next) => {
  let Conver;
  try {
    Conver = await CONVERSATION.find({ userId: req.body.userId });
  } catch (err) {
    const errors = new HttpError("find conversation failed", 500);
    return next(errors);
  }

  res.status(200).json({ conver: Conver });
};

const deleteMessages = async (req, res, next) => {
  try {
    await MESSAGE.deleteMany({ conversationId: req.body.converId });
  } catch (err) {
    const errors = new HttpError("delete message failed", 500);
    return next(errors);
  }

  try {
    await EXTRA.deleteMany({ conversationId: req.body.converId });
  } catch (err) {
    const errors = new HttpError("delete message failed", 500);
    return next(errors);
  }

  res.status(200).json({ message: "Conversation clear successfull" });
};

const createExtra = async (req, res, next) => {
  let message;

  if (!req.body.token) {
    let messages;

    try {
      messages = await EXTRA.find({ userId: req.body.userId });
    } catch (err) {
      console.log(err);
    }

    if (messages.length === 3) {
      const errors = new HttpError(
        "Login / Signup for free to send more messages.",
        500
      );
      return next(errors);
    }
  }

  try {
    message = await EXTRA.create(req.body);
  } catch (err) {
    const errors = new HttpError("create extra message failed", 500);
    return next(errors);
  }

  message.conversationId = req.body.converId;

  try {
    await message.save();
  } catch (err) {
    const errors = new HttpError("update message failed", 500);
    return next(errors);
  }

  res.status(200).json({ result: message });
};

const getConverHistory = async (req, res) => {
  let conver;

  try {
    conver = await CONVERSATION.find({ userId: req.userData.id });
  } catch (err) {
    const errors = new HttpError("fetch user conver failed", 500);
    return next(errors);
  }

  res.status(200).json(conver);
};

const getMessageHistory = async (req, res, next) => {
  let message;

  try {
    message = await MESSAGE.find({ userId: req.userData.id });
  } catch (err) {
    const errors = new HttpError("fetch user message failed", 500);
    return next(errors);
  }

  res.status(200).json(message);
};

const getSpamHistory = async (req, res, next) => {
  let message;

  try {
    message = await MESSAGE.find({
      $and: [{ userId: req.userData.id }, { spam: true }],
    });
  } catch (err) {
    const errors = new HttpError("fetch user spam message failed", 500);
    return next(errors);
  }

  res.status(200).json(message);
};

const updatePassord = async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  let user;
  let comparePass;
  let hashPass;

  try {
    user = await USER.findOne({ extraId: req.userData.id });
  } catch (err) {
    const errors = new HttpError("fetch user failed", 500);
    return next(errors);
  }

  try {
    comparePass = await bcrypt.compare(oldPassword, user.password);
  } catch (err) {
    const errors = new HttpError("password compare failed", 500);
    return next(errors);
  }
  if (!comparePass) {
    const errors = new HttpError("Sorry Your password is invalid", 500);
    return next(errors);
  }

  if (newPassword.trim().length < 6) {
    const errors = new HttpError(
      "Password should be at least 6 characters.",
      500
    );
    return next(errors);
  }
  try {
    hashPass = await bcrypt.hash(newPassword, 12);
  } catch (err) {
    const errors = new HttpError("password hashed failed", 500);
    return next(errors);
  }

  user.password = hashPass;

  try {
    await user.save();
  } catch (err) {
    const errors = new HttpError("update password failed", 500);
    return next(errors);
  }

  res.status(200).json({ message: "Password update successful" });
};

module.exports = {
  createGpt,
  createMessage,
  getMessage,
  createExtra,
  createConversation,
  getConversation,
  deleteMessages,
  getConverHistory,
  getMessageHistory,
  getSpamHistory,
  updatePassord,
};
