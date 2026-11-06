'use strict';

/* عند تشغيل Strapi: يمنح الزوار (Public) صلاحية القراءة فقط لمحتوى الموقع،
   حتى تعمل صفحات الموقع دون مفتاح API. لا يمنح أي صلاحية كتابة. */
const READ_ONLY = [
  'api::activity.activity',
  'api::project.project',
  'api::city.city',
  'api::news-item.news-item',
];

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (!role) return;

    for (const uid of READ_ONLY) {
      for (const action of ['find', 'findOne']) {
        const name = `${uid}.${action}`;
        const exists = await strapi.db
          .query('plugin::users-permissions.permission')
          .findOne({ where: { action: name, role: role.id } });
        if (!exists) {
          await strapi.db
            .query('plugin::users-permissions.permission')
            .create({ data: { action: name, role: role.id } });
        }
      }
    }
  },
};
