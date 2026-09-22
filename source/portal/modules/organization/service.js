'use strict';
module.exports = ({ db, activeJobs, hr, payroll, team, uid }) => {
  const repository = require('./repository')(db);
  return {
    context: async (req) => {
      const teamIds = await team(req);
      return {
        organization: await repository.organization(),
        canManage: hr(req),
        canPayroll: payroll(req),
        canReview: hr(req) || teamIds.length > 1,
        teamIds,
        people: await repository.people(),
        leaveTypes: await repository.leaveTypes(),
      };
    },
    hierarchy: async (req) => {
      const assignments = await activeJobs(db),
        all = hr(req) || ['ceo', 'director'].includes(req.user.roleName);
      let ids;
      if (!all) {
        ids = new Set(await team(req));
        let current = uid(req);
        while (current) {
          const job = assignments.find((j) => j.employee_id === current);
          current = job && job.manager_id;
          if (current && ids.has(current)) break;
          if (current) ids.add(current);
        }
      }
      const people = (await repository.hierarchyPeople(uid(req))).filter(
          (p) => !ids || ids.has(p.id)
        ),
        visible = new Set(people.map((p) => p.id));
      const parentOf = (id) => {
        let current = id;
        const seen = new Set();
        while (current && !visible.has(current)) {
          if (seen.has(current)) return null;
          seen.add(current);
          const job = assignments.find((j) => j.employee_id === current);
          current = job && job.manager_id;
        }
        return current || null;
      };
      return {
        scope: all ? 'Organization' : 'Your reporting network',
        nodes: people.map((p) => {
          const a = assignments.find((j) => j.employee_id === p.id) || {};
          return {
            ...p,
            managerId: parentOf(a.manager_id),
            department: a.department || 'Unassigned',
            designation: a.designation || '',
            location: a.location || '',
          };
        }),
      };
    },
  };
};
