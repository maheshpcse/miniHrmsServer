'use strict';
module.exports = (db) => ({
  organization: () => db('org_entity').first(),
  people: () =>
    db('employees')
      .where({ status: 1 })
      .whereNot('roleName', 'admin')
      .select('userId as id', 'empId', 'firstName', 'lastName'),
  hierarchyPeople: (currentId) =>
    db('employees')
      .whereNot('status', 0)
      .whereNot('roleName', 'admin')
      .whereNot('userId', currentId)
      .select('userId as id', 'firstName', 'lastName', 'roleName', 'empId'),
  leaveTypes: () => db('lv_leave_type').select('*'),
});
