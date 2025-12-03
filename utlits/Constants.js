// roleEnum.js
const RoleEnum = Object.freeze({
  ADMIN: 'admin',
  SUPER_ADMIN: 'superAdmin',
  SERVICE_PROVIDER: 'serviceProvider',
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
