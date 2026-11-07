/* إعدادات الموقع
   cms: رابط لوحة Strapi، مثل "https://cms.ydf.ly"
   إن تُرك فارغاً، أو تعذّر الوصول إلى Strapi، تعرض الصفحات البيانات المحلية في act-data.js */
window.YDF_CONFIG = {
  cms: "",
  /* وجهة النماذج. membership: "strapi" بعد ربط Strapi،
     أو {type:"forminator", url:"https://ydf.ly/wp-admin/admin-ajax.php", formId:"…", map:{fullName:"name-1", …}} حين يُنشأ النموذج في WordPress.
     فارغ = التسجيل مغلق مؤقتاً، وتعرض الصفحة رسالة ورابط واتساب. */
  forms: { membership: "" }
};
