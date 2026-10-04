import { describe, expect, it } from 'vitest';
import {
  matchSubmissionIdentity,
  ownSubmissionIdentity,
  tagGroupSlug,
} from '../src/shared/identity.js';

describe('matchSubmissionIdentity', () => {
  it('names the student whose login ends the repository name', () => {
    expect(matchSubmissionIdentity('cs-principles-lab-3-jsmith', ['jsmith'])).toEqual({
      assignment: 'cs-principles-lab-3',
      submitter: 'jsmith',
      studentLogin: 'jsmith',
    });
  });

  it('reads a team repository when no collaborator matches', () => {
    expect(matchSubmissionIdentity('cs-principles-lab-3-group-2', ['jsmith'])).toEqual({
      assignment: 'cs-principles-lab-3',
      submitter: 'group-2',
      studentLogin: '',
    });
  });

  it('gives a reason when the name follows no rule, or two collaborators fit', () => {
    expect(matchSubmissionIdentity('scratch', ['jsmith']).error).toBeTruthy();
    expect(matchSubmissionIdentity('lab-3-a-jsmith', ['jsmith', 'a-jsmith']).error).toBeTruthy();
  });
});

describe('ownSubmissionIdentity', () => {
  it("is the identity of a repository named for the account's login", () => {
    expect(ownSubmissionIdentity('cs-principles-lab-3-jsmith', 'JSmith')).toEqual({
      assignment: 'cs-principles-lab-3',
      submitter: 'JSmith',
      studentLogin: 'JSmith',
    });
  });

  it("is undefined for anyone else's repository", () => {
    expect(ownSubmissionIdentity('cs-principles-lab-3-jsmith', 'instructor')).toBeUndefined();
    // The login has to follow a hyphen, and cannot be the whole name.
    expect(ownSubmissionIdentity('cs-principles-lab-3-jsmith', 'smith')).toBeUndefined();
    expect(ownSubmissionIdentity('jsmith', 'jsmith')).toBeUndefined();
  });

  it('is undefined for a team repository, which is no one account’s', () => {
    expect(ownSubmissionIdentity('cs-principles-lab-3-group-2', 'jsmith')).toBeUndefined();
  });

  it('is undefined with no login', () => {
    expect(ownSubmissionIdentity('cs-principles-lab-3-jsmith', '')).toBeUndefined();
    expect(ownSubmissionIdentity('cs-principles-lab-3-jsmith', undefined)).toBeUndefined();
  });
});

describe('tagGroupSlug', () => {
  it('turns a tag pattern into a folder name', () => {
    expect(tagGroupSlug('submit/*')).toBe('submit');
    expect(tagGroupSlug('milestone-1/v*')).toBe('milestone-1-v');
  });

  it('falls back when nothing of the pattern can be kept', () => {
    expect(tagGroupSlug('*')).toBe('tag');
  });
});
