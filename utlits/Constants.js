// roleEnum.js
const RoleEnum = Object.freeze({
  ADMIN: 'admin',
  SUPER_ADMIN: 'superadmin',
});

const ActiveStatusEnum = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});
module.exports = {
  RoleEnum,
  ADMIN: RoleEnum.ADMIN,
  SUPER_ADMIN: RoleEnum.SUPER_ADMIN,
  ActiveStatusEnum,
};
