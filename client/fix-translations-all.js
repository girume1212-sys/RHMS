const fs = require('fs');
let content = fs.readFileSync('src/i18n/translations.js', 'utf8');

const langNewKeys = {
  am: {
    defaultPriority: '\u12E8\u12DE\u1295\u12F5 \u1348\u1276\u1260\u134D\u1293', low: '\u12A8\u122A\u1275', medium: '\u1273\u1295\u1293', high: '\u12E8\u122A\u1275', critical: '\u1348\u1276\u1260\u134D\u1293',
    requestEscalation: '\u134C\u120B\u1208\u1293 \u12A0\u124D \u1348\u1276\u1260\u134D\u1293', ticketAutoClose: '\u134C\u120B\u1208\u1293 \u1265\u1273\u1293\u1265\u1300 \u12E8\u12DA', days: '\u1265\u1293',
    assignmentRule: '\u12E8\u12DE\u1295\u12F5 \u1260\u1293\u12F1 \u1293\u12CD\u1293', selectAssignmentRule: '\u1260\u1293\u12F1 \u1293\u12CD\u1293 \u134D\u12F0\u1295\u121D', roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: '\u1273\u1295\u1293',
    escalationTrigger: '\u1348\u1276\u1260\u134D\u1293 \u1260\u129B\u1293\u1295', selectEscalationTrigger: '\u1348\u1276\u1260\u134D\u1293 \u1260\u129B\u1293\u1295 \u134D\u12F0\u1295\u121D', timeout: 'Timeout', priorityBased: '\u1348\u1276\u1260\u134D\u1293 \u12E8\u12DE\u1295\u12F5', noResponse: '\u12A0\u1235\u1325\u1308\u1237 \u1293\u1285',
    slaBreachAction: 'SLA \u1276\u1295\u130D\u1293 \u12E8\u12DA', selectSlaBreachAction: 'SLA \u1276\u1295\u130D\u1293 \u12E8\u12DA \u134D\u12F0\u1295\u121D', escalateImmediately: '\u1293\u121D\u1309\u1295 \u1348\u1276\u1260\u134D\u1293', notifyManager: '\u1273\u1247\u1295\u1293\u1295\u1293 \u1260\u1265\u1260\u1265\u1265\u1348\u1293', autoAssignSenior: '\u1265\u1325\u1295\u130D \u1293\u12CD\u1293\u1295\u1295\u1309\u1293 \u1260\u1293\u12F1', noAction: '\u12E8\u12DA \u1293\u1285',
    languageOptions: '\u1348\u134D\u1327\u1293 \u134D\u12F0\u1295\u1293\u1293', primaryLanguage: '\u12E8\u12DE\u1295\u12F5 \u1348\u134D\u1327\u1293', emailOnNewTicket: '\u1293\u1285 \u134C\u120B\u1208\u1295 \u12A0\u1260\u1295\u1295\u1266\u1235', emailOnNewTicketDesc: '\u1293\u1285 \u134C\u120B\u1208\u1295 \u1265\u1273\u1293\u1265\u1300 \u1260\u1265\u1260\u1265\u1265\u1348\u1293',
    emailOnStatusChange: '\u1293\u12CD\u1293\u1293 \u1293\u1285\u1323\u1235 \u1265\u1273\u1293\u1265\u1300 \u12A0\u1260\u1295\u1295\u1266\u1235', emailOnStatusChangeDesc: '\u1293\u12CD\u1293\u1293 \u1293\u1285\u1323\u1235 \u1265\u1273\u1293\u1265\u1300 \u1260\u1265\u1260\u1265\u1265\u1348\u1293', emailOnEscalation: '\u1348\u1276\u1260\u134D\u1293 \u1265\u1273\u1293\u1265\u1300 \u12A0\u1260\u1295\u1295\u1266\u1235', emailOnEscalationDesc: '\u1348\u1276\u1260\u134D\u1293 \u1265\u1273\u1293\u1265\u1300 \u1260\u1265\u1260\u1265\u1265\u1348\u1293',
    inAppNotifications: '\u12A3\u127A\u12CB\u1295\u1295 \u1260\u1265\u1260\u1265\u1265\u1348\u1293\u1293\u1293', inAppAlerts: '\u12A3\u127A\u12CB\u1295\u1295 \u1260\u1265\u1260\u1265\u1265\u1348\u1293\u1293\u1293', inAppAlertsDesc: '\u12A3\u127A\u12CB\u1295\u1295\u1276\u1283 \u1260\u1265\u1260\u1265\u1265\u1348\u1293\u1293\u1293 \u134D\u12F0\u1295\u121D', escalationAlerts: '\u1348\u1276\u1260\u134D\u1293 \u1260\u1265\u1260\u1265\u1265\u1348\u1293\u1293\u1293', escalationAlertsDesc: '\u1348\u1276\u1260\u134D\u1293 \u1260\u1265\u1260\u1265\u1265\u1348\u1293\u1293\u1293 \u134D\u12F0\u1295\u121D'
  },
  or: {
    defaultPriority: 'Dursee', low: 'Banaa', medium: 'Gidduugalee', high: 'Ol\u2019aa', critical: 'Criticaal',
    requestEscalation: 'Gaaffii fi Dorgommii', ticketAutoClose: 'Lakki Gaaffii Cufii', days: 'Guyyaa',
    assignmentRule: 'Dorgommii', selectAssignmentRule: 'Dorgommii Filadhu', roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: 'Hogee',
    escalationTrigger: 'Dorgommii', selectEscalationTrigger: 'Dorgommii Filadhu', timeout: 'Timeout', priorityBased: 'Dursee', noResponse: 'Amsuu Hin Jiru',
    slaBreachAction: 'SLA', selectSlaBreachAction: 'SLA Filadhu', escalateImmediately: 'Yeroon Dorgomaa', notifyManager: 'Baasii', autoAssignSenior: 'Guddaa\u2019ti', noAction: 'Hoja Hin Jiru',
    languageOptions: 'Afaan', primaryLanguage: 'Afaan Jajjabe', emailOnNewTicket: 'Imeeila Gaaffii Haaraa', emailOnNewTicketDesc: 'Gaaffii haaraa yoo kabame, isayyuu',
    emailOnStatusChange: 'Imeeila Haala Jijjiiramaa', emailOnStatusChangeDesc: 'Haala gaaffii yoo jijjiirame, isayyuu', emailOnEscalation: 'Imeeila Dorgommii', emailOnEscalationDesc: 'Dorgommii yoo kabame, isayyuu',
    inAppNotifications: 'Isaayyuu Keessaa', inAppAlerts: 'Isaayyuu Keessaa', inAppAlertsDesc: 'Isaayyuu keessaa mul\u2019isi', escalationAlerts: 'Isaayyuu Dorgommii', escalationAlertsDesc: 'Isaayyuu dorgommii mul\u2019isi'
  },
  so: {
    defaultPriority: 'Mudna', low: 'Hoos', medium: 'Dhexe', high: 'Sare', critical: 'Khatarti',
    requestEscalation: 'Codsiga iyo Sare u Qaadid', ticketAutoClose: 'Waqtiga Tirtirida Codsigga', days: 'Maalmaha',
    assignmentRule: 'Qoondeynta', selectAssignmentRule: 'Dooro Qoondeynta', roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: 'Gacanta',
    escalationTrigger: 'Sababta Sare u Qaadid', selectEscalationTrigger: 'Dooro Sababta', timeout: 'Waqtiga', priorityBased: 'Mudna', noResponse: 'Jawaab La\u2019aanta',
    slaBreachAction: 'SLA', selectSlaBreachAction: 'Dooro SLA', escalateImmediately: 'Si degdeg ah u sare u qaad', notifyManager: 'Maamulaha ogeysii', autoAssignSenior: 'Sare otos', noAction: 'Waxba',
    languageOptions: 'Luuqadaha', primaryLanguage: 'Luuqadda Aasaasiga', emailOnNewTicket: 'Email Codsiga Cusub', emailOnNewTicketDesc: 'Ogeysii marka codsig cusub la abuuray',
    emailOnStatusChange: 'Email Isbedelka Xaaladda', emailOnStatusChangeDesc: 'Ogeysii marka xaaladda beddelato', emailOnEscalation: 'Email Sare u Qaadid', emailOnEscalationDesc: 'Ogeysii marka la sare u qaado',
    inAppNotifications: 'Ogeysiisyada App-ka', inAppAlerts: 'Ogeysiisyada App-ka', inAppAlertsDesc: 'Muuqoo ogeysiisyada app-ka', escalationAlerts: 'Ogeysiisyada Sare u Qaadid', escalationAlertsDesc: 'Muuqoo ogeysiisyada sare u qaadidda'
  },
  ar: {
    defaultPriority: '\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629', low: '\u0645\u0646\u062E\u0641\u0636', medium: '\u0645\u062A\u0648\u0633\u0637', high: '\u0639\u0627\u0644\u064A', critical: '\u062D\u0631\u062C',
    requestEscalation: '\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u062A\u0635\u0639\u064A\u062F', ticketAutoClose: '\u0648\u0642\u062A \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u062A\u0637\u0644\u0628', days: '\u0627\u0644\u0623\u064A\u0627\u0645',
    assignmentRule: '\u0642\u0627\u0639\u062F \u0627\u0644\u062A\u0643\u0648\u064A\u0646', selectAssignmentRule: '\u0627\u062E\u062A\u0631 \u0642\u0627\u0639\u062F \u0627\u0644\u062A\u0643\u0648\u064A\u0646', roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: '\u064A\u0648\u0636\u0639\u064A',
    escalationTrigger: '\u0645\u062D\u0631\u0643 \u0627\u0644\u062A\u0635\u0639\u064A\u062F', selectEscalationTrigger: '\u0627\u062E\u062A\u0631 \u0645\u062D\u0631\u0643 \u0627\u0644\u062A\u0635\u0639\u064A\u062F', timeout: '\u0645\u0647\u0644\u0629 \u0627\u0644\u0648\u0642\u062A', priorityBased: '\u0645\u0639\u062A\u0645\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629', noResponse: '\u0644\u0627 \u0625\u062C\u0627\u0628\u0629',
    slaBreachAction: '\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u062A\u0632\u0645\u0639 \u0644\u0644\u0639\u0647\u062F', selectSlaBreachAction: '\u0627\u062E\u062A\u0631 \u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u062A\u0632\u0645\u0639', escalateImmediately: '\u062A\u0635\u0639\u064A\u062F \u0641\u0648\u0631\u064A\u0627\u064B', notifyManager: '\u0625\u062E\u0628\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0631', autoAssignSenior: '\u062A\u0643\u0648\u064A\u0646 \u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u0643\u0628\u064A\u0631', noAction: '\u0644\u0627 \u0625\u062C\u0631\u0627\u0621',
    languageOptions: '\u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A', primaryLanguage: '\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629', emailOnNewTicket: '\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0639\u0646 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F', emailOnNewTicketDesc: '\u0625\u0634\u0639\u0627\u0631 \u0639\u0646\u062F \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F',
    emailOnStatusChange: '\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0639\u0646 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062D\u0627\u0644\u0629', emailOnStatusChangeDesc: '\u0625\u0634\u0639\u0627\u0631 \u0639\u0646\u062F \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u062D\u0627\u0644\u0629', emailOnEscalation: '\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0639\u0646 \u0627\u0644\u062A\u0635\u0639\u064A\u062F', emailOnEscalationDesc: '\u0625\u0634\u0639\u0627\u0631 \u0639\u0646\u062F \u0627\u0644\u062A\u0635\u0639\u064A\u062F',
    inAppNotifications: '\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642', inAppAlerts: '\u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642', inAppAlertsDesc: '\u0639\u0631\u0636 \u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642', escalationAlerts: '\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u062A\u0635\u0639\u064A\u062F', escalationAlertsDesc: '\u0639\u0631\u0636 \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u062A\u0635\u0639\u064A\u062F'
  },
  fr: {
    defaultPriority: 'Priorit\u00e9 par d\u00e9faut', low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique',
    requestEscalation: 'Demandes et Escalade', ticketAutoClose: 'D\u00e9lai de fermeture auto', days: 'Jours',
    assignmentRule: 'R\u00e8gle d\u2019assignation', selectAssignmentRule: 'S\u00e9lectionner la r\u00e8gle', roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: 'Manuel',
    escalationTrigger: 'D\u00e9clencheur d\u2019escalade', selectEscalationTrigger: 'S\u00e9lectionner le d\u00e9clencheur', timeout: 'D\u00e9lai d\u2019attente', priorityBased: 'Bas\u00e9 sur la priorit\u00e9', noResponse: 'Pas de r\u00e9ponse',
    slaBreachAction: 'Action de br\u00e8che SLA', selectSlaBreachAction: 'S\u00e9lectionner l\u2019action', escalateImmediately: 'Escalader imm\u00e9diatement', notifyManager: 'Notifier le manager', autoAssignSenior: 'Assigner au s\u00e9nior', noAction: 'Aucune action',
    languageOptions: 'Options de langue', primaryLanguage: 'Langue principale', emailOnNewTicket: 'Email nouveau ticket', emailOnNewTicketDesc: 'Notifier lors de la cr\u00e9ation d\u2019un ticket',
    emailOnStatusChange: 'Email changement statut', emailOnStatusChangeDesc: 'Notifier lors du changement de statut', emailOnEscalation: 'Email lors de l\u2019escalade', emailOnEscalationDesc: 'Notifier lors de l\u2019escalade',
    inAppNotifications: 'Notifications dans l\u2019app', inAppAlerts: 'Alertes dans l\u2019app', inAppAlertsDesc: 'Afficher les alertes dans l\u2019application', escalationAlerts: 'Alertes d\u2019escalade', escalationAlertsDesc: 'Afficher les alertes d\u2019escalade'
  },
  es: {
    defaultPriority: 'Prioridad predeterminada', low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Cr\u00edtica',
    requestEscalation: 'Solicitudes y Escalaci\u00f3n', ticketAutoClose: 'Cierre autom\u00e1tico', days: 'D\u00edas',
    assignmentRule: 'Regla de asignaci\u00f3n', selectAssignmentRule: 'Seleccionar regla', roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: 'Manual',
    escalationTrigger: 'Activador de escalaci\u00f3n', selectEscalationTrigger: 'Seleccionar activador', timeout: 'Tiempo de espera', priorityBased: 'Basado en prioridad', noResponse: 'Sin respuesta',
    slaBreachAction: 'Acci\u00f3n de brecha SLA', selectSlaBreachAction: 'Seleccionar acci\u00f3n', escalateImmediately: 'Escalar inmediatamente', notifyManager: 'Notificar al gerente', autoAssignSenior: 'Asignar al senior', noAction: 'Sin acci\u00f3n',
    languageOptions: 'Opciones de idioma', primaryLanguage: 'Idioma principal', emailOnNewTicket: 'Email nuevo ticket', emailOnNewTicketDesc: 'Notificar al crear un ticket',
    emailOnStatusChange: 'Email cambio de estado', emailOnStatusChangeDesc: 'Notificar al cambiar el estado', emailOnEscalation: 'Email al escalar', emailOnEscalationDesc: 'Notificar al escalar',
    inAppNotifications: 'Notificaciones en la app', inAppAlerts: 'Alertas en la app', inAppAlertsDesc: 'Mostrar alertas en la aplicaci\u00f3n', escalationAlerts: 'Alertas de escalaci\u00f3n', escalationAlertsDesc: 'Mostrar alertas de escalaci\u00f3n'
  },
  pt: {
    defaultPriority: 'Prioridade padr\u00e3o', low: 'Baixa', medium: 'M\u00e9dia', high: 'Alta', critical: 'Cr\u00edtica',
    requestEscalation: 'Solicita\u00e7\u00f5es e Escala\u00e7\u00e3o', ticketAutoClose: 'Fechamento autom\u00e1tico', days: 'Dias',
    assignmentRule: 'Regra de atribui\u00e7\u00e3o', selectAssignmentRule: 'Selecionar regra', roundRobin: 'Round Robin', leastLoad: 'Least Load', manual: 'Manual',
    escalationTrigger: 'Gatilho de escala\u00e7\u00e3o', selectEscalationTrigger: 'Selecionar gatilho', timeout: 'Tempo limite', priorityBased: 'Baseado em prioridade', noResponse: 'Sem resposta',
    slaBreachAction: 'A\u00e7\u00e3o de viola\u00e7\u00e3o SLA', selectSlaBreachAction: 'Selecionar a\u00e7\u00e3o', escalateImmediately: 'Escalar imediatamente', notifyManager: 'Notificar gerente', autoAssignSenior: 'Atribuir ao s\u00eanior', noAction: 'Sem a\u00e7\u00e3o',
    languageOptions: 'Op\u00e7\u00f5es de idioma', primaryLanguage: 'Idioma principal', emailOnNewTicket: 'Email novo ticket', emailOnNewTicketDesc: 'Notificar ao criar um ticket',
    emailOnStatusChange: 'Email mudan\u00e7a status', emailOnStatusChangeDesc: 'Notificar ao mudar o status', emailOnEscalation: 'Email ao escalar', emailOnEscalationDesc: 'Notificar ao escalar',
    inAppNotifications: 'Notifica\u00e7\u00f5es no app', inAppAlerts: 'Alertas no app', inAppAlertsDesc: 'Mostrar alertas na aplica\u00e7\u00e3o', escalationAlerts: 'Alertas de escala\u00e7\u00e3o', escalationAlertsDesc: 'Mostrar alertas de escala\u00e7\u00e3o'
  },
  zh: {
    defaultPriority: '\u9ed8\u8ba4\u4f18\u5148\u7ea7', low: '\u4f4e', medium: '\u4e2d', high: '\u9ad8', critical: '\u5173\u952e',
    requestEscalation: '\u8bf7\u6c42\u4e0e\u5347\u7ea7', ticketAutoClose: '\u5de5\u5355\u81ea\u52a8\u5173\u95ed\u65f6\u95f4', days: '\u5929',
    assignmentRule: '\u9ed8\u8ba4\u5206\u914d\u89c4\u5219', selectAssignmentRule: '\u9009\u62e9\u5206\u914d\u89c4\u5219', roundRobin: '\u8f6e\u8be2', leastLoad: '\u6700\u5c0f\u8d1f\u8f7d', manual: '\u624b\u52a8',
    escalationTrigger: '\u5347\u7ea7\u89e6\u53d1\u5668', selectEscalationTrigger: '\u9009\u62e9\u5347\u7ea7\u89e6\u53d1\u5668', timeout: '\u8d85\u65f6', priorityBased: '\u57fa\u4e8e\u4f18\u5148\u7ea7', noResponse: '\u65e0\u54cd\u5e94',
    slaBreachAction: 'SLA \u8fdd\u7ea6\u884c\u52a8', selectSlaBreachAction: '\u9009\u62e9\u884c\u52a8', escalateImmediately: '\u7acb\u5373\u5347\u7ea7', notifyManager: '\u901a\u77e5\u7ecf\u7406', autoAssignSenior: '\u81ea\u52a8\u5206\u914d\u7ed9\u9ad8\u7ea7', noAction: '\u65e0\u64cd\u4f5c',
    languageOptions: '\u8bed\u8a00\u9009\u9879', primaryLanguage: '\u4e3b\u8981\u8bed\u8a00', emailOnNewTicket: '\u65b0\u5de5\u5355\u90ae\u4ef6\u901a\u77e5', emailOnNewTicketDesc: '\u521b\u5efa\u65b0\u5de5\u5355\u65f6\u901a\u77e5',
    emailOnStatusChange: '\u72b6\u6001\u53d8\u66f4\u90ae\u4ef6\u901a\u77e5', emailOnStatusChangeDesc: '\u5de5\u5355\u72b6\u6001\u53d8\u66f4\u65f6\u901a\u77e5', emailOnEscalation: '\u5347\u7ea7\u90ae\u4ef6\u901a\u77e5', emailOnEscalationDesc: '\u5de5\u5355\u5347\u7ea7\u65f6\u901a\u77e5',
    inAppNotifications: '\u5e94\u7528\u5185\u901a\u77e5', inAppAlerts: '\u5e94\u7528\u5185\u8b66\u62a5', inAppAlertsDesc: '\u5728\u5e94\u7528\u5185\u663e\u793a\u8b66\u62a5', escalationAlerts: '\u5347\u7ea7\u8b66\u62a5', escalationAlertsDesc: '\u663e\u793a\u5347\u7ea7\u8b66\u62a5'
  }
};

function injectLangKeys(langCode, newKeys) {
  const entries = Object.entries(newKeys).map(([k, v]) => `${k}: '${v}'`).join(', ');
  
  // Find the last settings key for this language (maintenanceModeDesc or holidaysEnabledDesc)
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`  ${langCode}: {`)) {
      // Found the language block - find its settings line
      for (let j = i; j < lines.length && j < i + 20; j++) {
        if (lines[j].includes('settings: {') && lines[j].includes('maintenanceModeDesc:')) {
          // Insert before the closing of the settings object
          lines[j] = lines[j].replace(/maintenanceModeDesc: '[^']*'/, (match) => match + ', ' + entries);
          content = lines.join('\n');
          console.log(`Injected keys for ${langCode}`);
          return true;
        }
      }
    }
  }
  console.log(`WARNING: Could not find settings block for ${langCode}`);
  return false;
}

for (const [lang, keys] of Object.entries(langNewKeys)) {
  injectLangKeys(lang, keys);
}

fs.writeFileSync('src/i18n/translations.js', content);
console.log('All languages updated');
