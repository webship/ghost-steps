@posts
Feature: The list of posts, its filters, sorting and counts
  The list of posts shows every post the user may see, with its status, and
  narrows by type, access, author, tag and featured.

  Background:
    Given I am logged in to the admin as "editor"
    And I am on the admin screen "Posts"

  @critical
  Scenario: The list shows posts with their status
    Then the list should have 18 posts
    And I should see the post "Welcome to the test site" in the list
    And the post "Welcome to the test site" should have the status "Published" in the list
    And the post "An unfinished draft" should have the status "Draft" in the list
    And I should not see the post "A post that does not exist" in the list

  Scenario: The list is filtered by type
    When I filter the list by "Post type" with "Draft posts"
    Then the list should have 3 posts
    And I should see the post "An unfinished draft" in the list
    And I should not see the post "Welcome to the test site" in the list
    When I clear the list filters
    Then the list should have 18 posts

  Scenario: The list is filtered by tag
    When I filter the list by "Tag" with "Guides"
    Then the list should have 2 posts
    And I should see the post "A guide to writing" in the list
    And I should see the post "A guide to editing" in the list

  Scenario: The list is filtered by author
    When I filter the list by "Author" with "Arthur Author"
    Then the list should have 7 posts
    And I should see the post "A draft by the author" in the list
    And I should not see the post "A guide to editing" in the list

  Scenario: The list is filtered by access
    When I filter the list by "Access" with "Members-only"
    Then the list should have 1 post
    And I should see the post "Members only notes" in the list

  Scenario: The list is filtered to featured posts
    When I filter the list by "Featured"
    Then the list should have 1 post
    And I should see the post "Welcome to the test site" in the list

  Scenario: Two filters narrow the list together
    When I filter the list by "Tag" with "Travel"
    And I filter the list by "Author" with "Edith Editor"
    Then the list should have 5 posts
    And I should see the post "News from the south" in the list
    And I should not see the post "News from the north" in the list

  Scenario: The list is sorted
    When I go to the admin screen "Published"
    And I sort the list by "Oldest first"
    Then the first row of the list should be "Welcome to the test site"
    When I sort the list by "Newest first"
    Then the first row of the list should be "Coming soon"

  Scenario: The menu shows the scheduled and published posts
    When I go to the admin screen "Published"
    Then the list should have 15 posts
    When I go to the admin screen "Scheduled"
    Then the list should have 0 posts
