import { CognitoAuth } from '../../lib/amazon-cognito-auth';


function initCognitoSDK() {
  return new Promise(((resolve, reject) => {
    const authData = {
      ClientId: window.CORNETTO.cognito.APP_CLIENT_ID, // Your client id here
      AppWebDomain: window.CORNETTO.cognito.USER_POOL_LOGIN_URL,
      TokenScopesArray: ['openid'],
      RedirectUriSignIn: 'https://mehrnebel.cornetto.cloud/buzzer',
      RedirectUriSignOut: 'https://dutrinkst.cornetto.cloud',
    };
    const auth = new CognitoAuth(authData);
    auth.userhandler = {
      onSuccess() { resolve(auth); },
      onFailure() { reject(auth); },
    };
    const curUrl = window.location.href;
    auth.useCodeGrantFlow();
    auth.parseCognitoWebResponse(curUrl);
    window.auth = auth;
    if (!window.location.search.includes('code')) {
      resolve(auth);
    } else {
      window.history.pushState({}, document.title, '/buzzer');
    }
    return auth;
  }));
}

const authPromise = initCognitoSDK();


async function login() {
  const auth = await authPromise;
  return new Promise((resolve, reject) => {
    auth.userhandler = {
      onSuccess(result) {
        resolve(result);
      },
      onFailure(err) {
        reject(err);
      },
    };
    auth.getSession();
  });
}

async function getAuthorizationToken() {
  if (process.env.NODE_ENV !== 'production') {
    return 'any token';
  }
  const session = await login();
  return session.getIdToken().getJwtToken();
}

function logout() {
  // return auth.signOut();
}
function isLoggedIn() {
  return true;
}

export { login, logout, isLoggedIn, getAuthorizationToken };