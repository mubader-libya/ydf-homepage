'use strict';

/* عند تشغيل Strapi: يمنح الزوار (Public) صلاحية القراءة فقط لمحتوى الموقع،
   حتى تعمل صفحات الموقع دون مفتاح API. لا يمنح أي صلاحية كتابة. */
const READ_ONLY = [
  'api::activity.activity',
  'api::project.project',
  'api::city.city',
  'api::news-item.news-item',
  'api::article.article',
];

/* أنواع يُسمح للزوار بالإرسال إليها فقط (create)، دون قراءة */
const CREATE_ONLY = ['api::membership-application.membership-application'];

module.exports = {
  register() {},

  async bootstrap({ strapi }) {
    const role = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (!role) return;

    const grants = READ_ONLY.flatMap((uid) => ['find', 'findOne'].map((a) => [uid, a]))
      .concat(CREATE_ONLY.map((uid) => [uid, 'create']));
    for (const [uid, action] of grants) {
      {
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
