import React from 'react';
import { Route } from 'react-router-dom';
import { NavItem } from 'react-bootstrap';

export default props =>
  (<Route
    path={props.href}
    exact
    children={({ match, history }) =>// eslint-disable-line
      (<NavItem
        onClick={e => history.push(e.currentTarget.getAttribute('href'))}
        {...props}
        active={!!match}
      >
        {props.children}
      </NavItem>)}
  />);