const { nanoid } = require('nanoid');

const generateStampId = () => `stmp_${nanoid(16)}`;
const generateAgentId = () => `agt_${nanoid(16)}`;
const generateWishId = () => `wish_${nanoid(16)}`;
const generateEndorsementId = () => `end_${nanoid(16)}`;
const generateTransactionId = () => `txn_${nanoid(16)}`;

module.exports = {
  generateStampId,
  generateAgentId,
  generateWishId,
  generateEndorsementId,
  generateTransactionId,
};
