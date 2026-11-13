@search
Feature: The search of the site
  Visitors search posts, tags and authors from the search button of the
  theme.

  Background:
    Given I am an anonymous user
    And I am on the homepage

  @critical
  Scenario: The search finds a post and opens it
    When I open the site search
    And I search the site for "Travel diary 3"
    Then I should see the site search result "Travel diary 3"
    And I should not see the site search result "Travel diary 4"
    When I open the site search result "Travel diary 3"
    Then the page should be a post
    And I should see "Day 3 of the journey."

  Scenario: The search finds tags and authors
    When I search the site for "Guides"
    Then I should see the site search result "Guides"
    When I search the site for "Arthur"
    Then I should see the site search result "Arthur Author"

  Scenario: The search does not find drafts
    When I search the site for "unfinished"
    Then I should not see the site search result "An unfinished draft"

  Scenario: The search closes
    When I open the site search
    And I close the site search
    Then the page should be the home page
