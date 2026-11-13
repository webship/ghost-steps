@site
Feature: The front end: pages, archives, feed and navigation
  The site renders the home page, posts, pages and the archives of tags and
  authors, pages its archives and prints the navigation links.

  Background:
    Given I am an anonymous user

  @critical
  Scenario: The home page lists the posts
    When I go to the homepage
    Then the page should be the home page
    And the page generator should start with "Ghost 6"
    And I should see the post "Travel diary 8" in the post feed
    And I should not see the post "An unfinished draft" in the post feed
    And I should see "Home" in the site navigation
    And I should see "About" in the site navigation
    And I should not see "Docs" in the site navigation
    And I should see a subscribe button

  Scenario: The home page is the first page of an archive
    When I go to the homepage
    Then the archive should be on page 1
    And the post feed should have 12 posts
    And the archive should have a next page
    And the archive should not have a previous page
    When I go to the next page of the archive
    Then the archive should be on page 2
    And the archive should have a previous page
    And the archive should not have a next page
    And I should see the post "Welcome to the test site" in the post feed
    When I go to the previous page of the archive
    Then the archive should be on page 1
    And the page should be the home page

  Scenario: A post has its own page
    When I go to "/welcome-to-the-test-site/"
    Then the page should be a post
    And the page should not be a page
    And I should see "This is the welcome post."
    And I should see "A second heading"
    And the post should not be restricted to members
    And the response status code should be 200

  Scenario: A page has its own page
    When I go to "/contact/"
    Then the page should be a page
    And the page should not be a post
    And I should see "Write to the test site."

  Scenario: A tag has an archive
    When I go to "/tag/guides/"
    Then the page should be a tag archive
    And the page should be the tag archive of "guides"
    And the post feed should have 2 posts
    And I should see the post "A guide to writing" in the post feed
    And I should see the post "A guide to editing" in the post feed
    And I should not see the post "Travel diary 1" in the post feed
    And I should see "How to do things."
    And the archive should be on page 1
    And the archive should not have a next page

  Scenario: An author has an archive
    When I go to "/author/arthur/"
    Then the page should be an author archive
    And the page should be the author archive of "arthur"
    And the post feed should have 6 posts
    And I should see the post "A guide to writing" in the post feed
    And I should not see the post "A guide to editing" in the post feed
    And I should not see the post "A draft by the author" in the post feed

  Scenario: A draft has no public page
    When I go to "/an-unfinished-draft/"
    Then the response status code should be 404

  Scenario: The home page passes the structural accessibility checks
    When I go to the homepage
    Then the page should have a title
    And every image should have an alt attribute
