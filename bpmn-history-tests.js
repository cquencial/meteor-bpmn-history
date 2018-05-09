/* eslint-env mocha */
import { Bpmn } from 'meteor/cquencial:bpmn-engine';
import { assert } from 'meteor/practicalmeteor:chai';
import { Random } from 'meteor/random';
import { Mongo } from 'meteor/mongo';
import {Meteor} from 'meteor/meteor';

const resumeState = require('./tests/resumeState.json');
const { EventEmitter } = require('events');

const processWithoutUserTask =
  `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <task id="userTask" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;

const processWithUserTask = `
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <process id="theProcess" isExecutable="true">
    <startEvent id="theStart" />
    <userTask id="userTask" />
    <endEvent id="theEnd" />
    <sequenceFlow id="flow1" sourceRef="theStart" targetRef="userTask" />
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="theEnd" />
  </process>
</definitions>`;


const Events = {
  start: 'start',
  enter: 'enter',
  end: 'end',
  wait: 'wait',
  leave: 'leave',
  taken: 'taken',
  cancel: 'cancel',
  error: 'error',
  discarded: 'discarded',
};

const PreventEvents = {
  start: false,
  enter: false,
  end: false,
  wait: false,
  leave: false,
  taken: false,
  cancel: false,
  error: false,
  discarded: false,
};

const EventsList = Object.values(Events);
const randomEvent = function () {
  return EventsList[Math.floor(Math.random() * EventsList.length)];
};

describe('bpmn-history extension', function () {
  const isDefined = function (target, expectedType) {
    assert.isDefined(target);
    assert.isTrue(typeof target === expectedType);
  };

  beforeEach(() => {
    Bpmn.history.on();
  });

  afterEach(() => {
    Bpmn.history.off();
  });


  describe('Bpmn.Events definitions (history extension)', function () {
    it('has been extended by resume and stop', function () {
      assert.equal(Bpmn.Events.start, 'start');
      assert.equal(Bpmn.Events.enter, 'enter');
      assert.equal(Bpmn.Events.end, 'end');
      assert.equal(Bpmn.Events.taken, 'taken');
      assert.equal(Bpmn.Events.discarded, 'discarded');
      assert.equal(Bpmn.Events.leave, 'leave');
      assert.equal(Bpmn.Events.wait, 'wait');
      assert.equal(Bpmn.Events.resume, 'resume');
      assert.equal(Bpmn.Events.stop, 'stop');
      assert.equal(Bpmn.Events.error, 'error');
    });
  });

  describe('Bpmn.history.collection', function () {

    it('is a Mongo.Collection to collect history entries', function () {
      assert.isTrue(Bpmn.history.collection instanceof Mongo.Collection);
    });

    it('has an optional schema definition', function () {
      isDefined(Bpmn.history.collection.schema, 'object');
    });
  });

  describe('Bpmn.history.add', function () {

    it('adds an entry to the history according to the collection schema', function () {
      const insertDoc = {
        instanceId: Random.id(),
        processId: Random.id(),
        elementId: Random.id(),
        eventName: randomEvent(),
        stateName: Random.id(),
        userId: Random.id(),
      };
      const historyDocId = Bpmn.history.add(insertDoc);
      isDefined(historyDocId, 'string');
      const historyDoc = Bpmn.history.collection.findOne({_id: historyDocId});
      assert.equal(historyDoc.instanceId, insertDoc.instanceId);
      assert.equal(historyDoc.processId, insertDoc.processId);
      assert.equal(historyDoc.elementId, insertDoc.elementId);
      assert.equal(historyDoc.eventName, insertDoc.eventName);
      assert.equal(historyDoc.state, insertDoc.state);
      isDefined(historyDoc._id, 'string');
      isDefined(historyDoc.createdAt, 'object');
      assert.equal(historyDoc.createdBy, insertDoc.userId);
    });

  });

  describe('Engine.execute (history extension)', function () {

    const execute = function ({ source, expectedEvents, leastEvents, hasEvents, prevent, done }) {
      const engine = new Bpmn.Engine({ source });

      const instanceId = Random.id();
      engine.instanceId = instanceId;

      engine.on('end', Meteor.bindEnvironment(() => {
        const history = Bpmn.history.collection.find({ instanceId }).fetch();

        if (typeof leastEvents !== 'undefined') {
          assert.isTrue(history.length > leastEvents);
        }

        if (typeof expectedEvents !== 'undefined') {
          assert.equal(history.length, expectedEvents);
        }

        if (typeof hasEvents !== 'undefined') {
          const mappedEvents = history.map(h => h.eventName);
          mappedEvents.forEach((evt) => {
            assert.notEqual(mappedEvents.indexOf(evt), -1, `${evt}=>${mappedEvents.toString()}`);
          });
        }
        done();
      }));

      const options = {
      };
      if (prevent) options.prevent = prevent;
      engine.execute(options);
    };


    it ('attaches listeners to any execution by default', function (done) {
      const engine = new Bpmn.Engine({ source: processWithoutUserTask});
      engine.execute({}, (err, readyEngine) => {
        const listeners = Object.keys(readyEngine.processes[0].listener._events);
        Object.values(Events).forEach((eventName)=>{
          assert.notEqual(listeners.indexOf(eventName), -1);
        });
        done();
      })
    });

    it('logs engine events to the history collection', function (done) {
      execute({
        source: processWithoutUserTask,
        hasEvents: [Events.start, Events.enter, Events.end], // TODO test the rest
        done,
      });
    });

    it('allows to restrict the events to be logged', function (done) {
      execute({
        source: processWithoutUserTask,
        expectedEvents: 0,
        done,
        prevent: PreventEvents,
      });
    });
  });

  describe('Engine.stop', function () {

    it('logs a history entry, that the engine has been stopped', function (done) {
      const engine = new Bpmn.Engine({ source: processWithUserTask });

      const instanceId = Random.id();
      engine.instanceId = instanceId;

      engine.on('end', Meteor.bindEnvironment(() => {
        Meteor._sleepForMs(300);
        const history = Bpmn.history.collection.find({ instanceId }).fetch();
        assert.equal(history.length, 1);
        const entry = history[0];
        assert.equal(entry.eventName, 'stop');
        done();
      }));

      engine.execute({

        prevent: PreventEvents,
      }, function () {
        engine.stop();
      });
    });
  });

  describe('Engine.resume (history extension)', function () {

    it('logs, that the engine has been resumed', function (done) {
      const engine = new Bpmn.Engine({ source: processWithUserTask });

      const instanceId = Random.id();
      engine.instanceId = instanceId;

      const prevent = Object.assign({}, PreventEvents);

      let state;

      engine.on('end', Meteor.bindEnvironment(() => {
        Meteor._sleepForMs(200);
        const history = Bpmn.history.collection.find({ instanceId }).fetch();
        const eventMap = history.map(h => h.eventName).sort();
        assert.deepEqual(eventMap, [Bpmn.Events.stop]);


        Bpmn.Engine.resume(state, { instanceId, prevent }, Meteor.bindEnvironment(() => {
          Meteor._sleepForMs(200);
          const resumeHistory = Bpmn.history.collection.find({ instanceId }).fetch();
          const resumeEventMap = resumeHistory.map(h => h.eventName).sort();
          assert.deepEqual(resumeEventMap, [Bpmn.Events.resume, Bpmn.Events.stop]);
          done();
        }));
      }));

      const waitListener = new EventEmitter();
      waitListener.on('wait',  Meteor.bindEnvironment(() => {
        state = engine.getState();
        engine.stop();
      }));

      engine.execute({
        prevent,
        listener: waitListener,
      });
    });

    it('logs entries after resume', function (done) {
      const instanceId = Random.id();
      const preventEvents = Object.assign({}, PreventEvents);

      delete preventEvents.end; // listen only to end

      const waitListener = new EventEmitter();
      waitListener.on('wait', Meteor.bindEnvironment( (element) => {
        element.signal();
      }));

      const engine = Bpmn.Engine.resume(resumeState, { instanceId, prevent: preventEvents, listener: waitListener });
      engine.on('end', Meteor.bindEnvironment(() => {
        Meteor._sleepForMs(150);
        const history = Bpmn.history.collection.find({ instanceId }).fetch();
        const eventMap = history.map(h => h.eventName).sort();
        assert.deepEqual(history.map(el => el.elementId).sort(), [
          'anonymous',
          'theEnd',
          'undefined',
          'userTask',
        ].sort());
        assert.deepEqual(eventMap, [Bpmn.Events.end, Bpmn.Events.end, Bpmn.Events.end, Bpmn.Events.resume]);
        done();
      }));
    });
  });

  it('does not log events before the restore point twice', function (done) {
    const engine = new Bpmn.Engine({ source: processWithUserTask });

    const instanceId = Random.id();
    engine.instanceId = instanceId;

    const prevent = Object.assign({}, PreventEvents);
    delete prevent.enter; // listen only to enter

    let state;

    engine.on('end', Meteor.bindEnvironment(() => {
      Meteor._sleepForMs(200);
      const history = Bpmn.history.collection.find({ instanceId }).fetch();
      const eventMap = history.map(h => h.eventName).sort();
      assert.deepEqual(eventMap, [Bpmn.Events.enter, Bpmn.Events.enter, Bpmn.Events.stop]);


      Bpmn.Engine.resume(state, { instanceId, prevent }, Meteor.bindEnvironment(() => {
        Meteor._sleepForMs(200);
        const resumeHistory = Bpmn.history.collection.find({ instanceId }).fetch();
        const resumeEventMap = resumeHistory.map(h => h.eventName).sort();
        assert.deepEqual(resumeEventMap, [
          Bpmn.Events.enter, // start event
          Bpmn.Events.enter, // task (before resume)
          Bpmn.Events.enter, // task (after resume)
          Bpmn.Events.resume,
          Bpmn.Events.stop,
        ]);
        done();
      }));
    }));

    const waitListener = new EventEmitter();
    waitListener.on('wait',  Meteor.bindEnvironment(() => {
      state = engine.getState();
      engine.stop();
    }));

    engine.execute({
      prevent,
      listener: waitListener,
    });
  });

  it('logs events before and after resume in the correct sequential order', function (done) {
    const engine = new Bpmn.Engine({ source: processWithUserTask });

    const instanceId = Random.id();
    engine.instanceId = instanceId;

    const prevent = Object.assign({}, PreventEvents);
    delete prevent.enter; // listen only to enter

    let state;

    engine.on('end', Meteor.bindEnvironment(() => {
      Meteor._sleepForMs(200);
      const history = Bpmn.history.collection.find({ instanceId }).fetch();
      assert.equal(history.length, 3, instanceId); // enter, enter, stop
      const eventMap = history.map(h => h.eventName).sort();
      assert.deepEqual(eventMap, [Bpmn.Events.enter, Bpmn.Events.enter, Bpmn.Events.stop]);


      Bpmn.Engine.resume(state, { instanceId, prevent }, Meteor.bindEnvironment(() => {
        Meteor._sleepForMs(200);
        const resumeHistory = Bpmn.history.collection.find({ instanceId }, {sort: { createdAt: 1 }}).fetch();
        const resumeEventMap = resumeHistory.map(h => h.eventName);
        assert.deepEqual(resumeEventMap, [
          Bpmn.Events.enter, // start event
          Bpmn.Events.enter, // task (before resume)
          Bpmn.Events.stop,
          Bpmn.Events.resume,
          Bpmn.Events.enter, // task (after resume)
        ]);
        done();
      }));
    }));

    const waitListener = new EventEmitter();
    waitListener.on('wait', Meteor.bindEnvironment(() => {
      state = engine.getState();
      engine.stop();
    }));

    engine.execute({
      prevent,
      listener: waitListener,
    });
  });


  describe('stress tests', function () {

    it('handles recurring stop/resume ping-pong (no hooks)', function (done) {
      this.timeout(5000);

      let engine;
      let resumeStateLocal;
      let count = 0;

      const maxPingPong = 10;
      const instanceId = Random.id();

      const waitListener = new EventEmitter();
      waitListener.on('wait', Meteor.bindEnvironment(() => {
        Meteor._sleepForMs(50);
        resumeStateLocal = engine.getState();
        engine.stop();
      }));

      function pong() {
        Meteor._sleepForMs(50);

        count += 1;
        if (count < maxPingPong) {
          Meteor._sleepForMs(50);
          ping({ listener: waitListener }); // eslint-disable-line no-use-before-define
        } else {
          done();
        }
      }

      function ping({ listener, prevent }) {
        engine = Bpmn.Engine.resume(resumeStateLocal, { instanceId, prevent, listener,});
        engine.on('end', Meteor.bindEnvironment(pong));
      }

      // INIT PING PONG
      engine = new Bpmn.Engine({ source: processWithUserTask, });
      engine.instanceId = instanceId;
      engine.on('end', Meteor.bindEnvironment(pong));
      engine.execute({
        listener: waitListener,
      });
    });



    it('handles recurring stop/resume ping-pong', function (done) {
      this.timeout(5000);

      let engine;
      let resumeStateLocal;
      let count = 0;

      const maxPingPong = 10;
      const instanceId = Random.id();

      const countEvent = (arr, evt) => arr.filter(entry => entry === evt).length;

      const waitListener = new EventEmitter();
      waitListener.on('wait', Meteor.bindEnvironment(() => {
        Meteor._sleepForMs(50);
        resumeStateLocal = engine.getState();
        engine.stop();
      }));

      function pong() {
        Meteor._sleepForMs(50);
        const history = Bpmn.history.collection.find({ instanceId }).fetch();
        const eventMap = history.map(h => h.eventName).sort();
        count += 1;
        if (count < maxPingPong) {
          Meteor._sleepForMs(50);
          ping({ listener: waitListener, prevent: PreventEvents }); // eslint-disable-line no-use-before-define
        } else {
          assert.equal(countEvent(eventMap, Bpmn.Events.resume), count - 1);
          assert.equal(countEvent(eventMap, Bpmn.Events.stop), count); // because we bootstrapped using stop()
          done();
        }
      }

      function ping({ listener, prevent }) {
        engine = Bpmn.Engine.resume(resumeStateLocal, { instanceId, prevent, listener,});
        engine.on('end', Meteor.bindEnvironment(pong));
      }

      // INIT PING PONG
      engine = new Bpmn.Engine({ source: processWithUserTask, });
      engine.instanceId = instanceId;
      engine.on('end', Meteor.bindEnvironment(pong));
      engine.execute({
        prevent: PreventEvents,
        listener: waitListener,
      });
    });

  });
});



