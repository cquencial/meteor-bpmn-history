Package.describe({
  name: 'cquencial:bpmn-history',
  version: '0.1.0',
  // Brief, one-line summary of the package.
  summary: 'Provides a detailed history of all process steps for cquencial:bpmn-engine.',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/cquencial/meteor-bpmn-history.git',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md',
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1');
  api.use(['ecmascript', 'mongo', 'check', 'cquencial:bpmn-engine@0.1.0']);
  api.addFiles('bpmn-history.js');
});

Package.onTest(function (api) {
  api.use('ecmascript');
  // api.use('meteor');
  // api.use('check');
  // api.use('mongo');
  api.use('random');
  api.use('cquencial:bpmn-history');
  api.use('meteortesting:mocha');
  api.use('practicalmeteor:chai');
  api.mainModule('bpmn-history-tests.js');
});
