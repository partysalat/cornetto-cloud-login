// Original taken from https://github.com/emdgroup/cfn-custom-resource
// This is not included somewhere, only for documentary purposes.
// It is copied directly into customResources.yaml because cloudformation is not supporting Cognito UserPoolDomains yet.

const AWS = require('aws-sdk'),
  jmespath = require('jmespath'),
  querystring = require('querystring'),
  crypto = require('crypto'),
  https = require("https"),
  url = require("url");

exports.handler = (event, ctx, cb) => {
  console.log('Request', JSON.stringify(Object.assign({}, event, {
    ResourceProperties: null
  })));
  event.ResourceProperties = fixBooleans(event.ResourceProperties, event.PhysicalResourceId);
  let args = event.ResourceProperties[event.RequestType];
  if (!args) args = event.RequestType === 'Delete' ? {} : event.ResourceProperties['Create'];
  ['Attributes', 'PhysicalResourceId', 'PhysicalResourceIdQuery', 'Parameters'].forEach(attr =>
    args[attr] = args[attr] || event.ResourceProperties[attr]
  );
  if (event.RequestType === 'Delete') {
    deleteResource(args, event, ctx, function(data) {
      response.send(event, ctx, response.SUCCESS, {}, event.PhysicalResourceId);
    });
  } else if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    createOrUpdateResource(args, event, ctx, function(data) {
      let props = event.ResourceProperties[event.RequestType] || event.ResourceProperties['Create'];
      if (props.PhysicalResourceIdQuery) event.PhysicalResourceId = jmespath.search(data, props.PhysicalResourceIdQuery);
      if (props.PhysicalResourceId) event.PhysicalResourceId = props.PhysicalResourceId;
      if (props.Attributes) data = jmespath.search(data, props.Attributes);
      response.send(event, ctx, response.SUCCESS, data, event.PhysicalResourceId);
    });
  }
};

function random() {
  return crypto.randomBytes(6).toString('base64').replace(/[\+=\/]/g, '').toUpperCase();
}

function fixBooleans(obj, physicalId) {
  if (Array.isArray(obj)) return obj.map(item => fixBooleans(item, physicalId));
  else if (typeof obj === 'object') {
    for (key in obj) obj[key] = fixBooleans(obj[key], physicalId);
    return obj;
  } else if (typeof obj === 'string')
    return obj === 'true' ? true :
      obj === 'false' ? false :
        obj === 'null' ? null :
          obj.replace(/\${PhysicalId}/, physicalId).replace(/\${Random}/, random());
  else return obj;
}

function deleteResource(args, event, ctx, cb) {
  request(args, event, function(err, data) {
    if (err && args.IgnoreErrors !== true) {
      response.send(event, ctx, response.FAILED, err, event.PhysicalResourceId);
    } else cb(data);
  });
}

function createOrUpdateResource(args, event, ctx, cb) {
  request(args, event, function(err, data) {
    if (err && args.IgnoreErrors !== true) {
      response.send(event, ctx, response.FAILED, err, event.PhysicalResourceId);
    } else cb(data);
  });
}

function request(args, event, cb) {
  if (event.RequestType === 'Delete' && !args.Action) return cb();
  let client = new AWS[event.ResourceProperties.Service]();
  client[args.Action](args.Parameters, cb);
}

let response = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  body: function(event, ctx, responseStatus, responseData, pId) {
    let body = {
      Status: responseStatus,
      Reason: responseData instanceof Error ? responseData.toString() : '',
      PhysicalResourceId: pId || event.RequestId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: responseStatus === response.FAILED ? null : responseData,
    }
    if(JSON.stringify(body).length > 4096) {
      console.log('truncated responseData as it exceeded 4096 bytes');
      return Object.assign(body, { Data: null });
    } else {
      return body;
    }
  },
  send: function(event, ctx) {
    let responseBody = response.body.apply(this, arguments);
    console.log('Response', JSON.stringify(Object.assign({}, responseBody, {
      Data: null
    })));

    var parsed = url.parse(event.ResponseURL);
    https.request({
      hostname: parsed.hostname,
      path: parsed.path,
      method: 'PUT',
    }, res => () => ctx.done()).on("error", function(error) {
      console.log(error);
      ctx.done();
    }).end(JSON.stringify(responseBody));
  },
};