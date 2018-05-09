# cquencial:bpmn-history

[![Build Status](https://travis-ci.org/cquencial/meteor-bpmn-history.svg?branch=master)](https://travis-ci.org/cquencial/meteor-bpmn-history)

Provides a detailed history of all process steps for `cquencial:bpmn-engine`.


### Installation

Add this package with `cquencial:bpmn-engine` to your packages list (if you didn't already install `cquencial:bpmn-engine`):

`meteor add cquencial:bpmn-engine cquencial:bpmn-history`

In your server environment you need to switch the extension to `on`:


### Usage

```javascript
import { Bpmn } from 'cquencial:bpmn-engine';

Bpmn.history.on();
```

This activates the extension to listen to every internal event, that the engine dispatches.

If you want to extension to be `off` just call

```javascript
Bpmn.history.off();
```

### Collection

The extension comes with a collection by default and inserts a document for each event, that is dispatched.

The collection has no schema attached (as in terms of collection level validation) as it is up to you to decide, whether and how to do that.

However, the package follows implictly a schema, that is also added as property to the collection:

The documents have the following schema:

```javascript
Bpmn.history.collection.schema = {
  createdAt: Date,
  createdBy: String,
  instanceId: String,
  processId: String,
  elementId: String,
  eventName: String,
  stateName: String,
};
```


### Publications

There is no default publication included with this package as this should be your decision what data to publish to whom.