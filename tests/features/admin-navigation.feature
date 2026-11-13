@admin
Feature: The admin menu, its screens and the search of the admin
  The admin opens its screens from a menu, shows who is signed in in the
  user menu and finds posts, pages, tags and staff with its search.

  Background:
    Given I am logged in to the admin as "owner"

  @critical
  Scenario: The menu lists the screens of the admin
    Then I should see "Posts" in the admin menu
    And I should see "Pages" in the admin menu
    And I should see "Tags" in the admin menu
    And I should see "Members" in the admin menu
    And I should see "Settings" in the admin menu
    And I should not see "Billing" in the admin menu

  Scenario: The menu opens the screens
    When I click "Posts" in the admin menu
    Then I should be on the admin screen "Posts"
    When I click "Drafts" in the admin menu
    Then I should be on the admin screen "Drafts"
    And I should see the post "An unfinished draft" in the list
    When I click "Pages" in the admin menu
    Then I should be on the admin screen "Pages"
    And I should see the page "Contact" in the list
    When I click "Tags" in the admin menu
    Then I should be on the admin screen "Tags"
    When I click "Members" in the admin menu
    Then I should be on the admin screen "Members"
    And I should not be on the admin screen "Tags"

  Scenario: A screen opens by its name or its route
    When I go to the admin screen "Tags"
    Then I should be on the admin screen "Tags"
    When I go to the admin screen "posts?type=published"
    Then I should be on the admin screen "Published"
    When I go to the admin screen "Staff"
    Then I should be on the admin screen "settings/staff"

  Scenario: The user menu shows who is signed in
    Then the user menu should show "Olivia Owner"
    And the user menu should show "owner@example.com"
    And the user menu should show "Your profile"
    And the user menu should show "Sign out"

  Scenario: The search of the admin finds a post and opens it
    When I search the admin for "Travel diary 3"
    Then I should see the admin search result "Travel diary 3"
    And I should not see the admin search result "Travel diary 4"
    When I open the admin search result "Travel diary 3"
    Then the editor title should be "Travel diary 3"

  Scenario: The search of the admin finds tags and has no result for nonsense
    When I search the admin for "Guides"
    Then I should see the admin search result "Guides"
    When I search the admin for "zzzz nothing like this"
    Then I should not see the admin search result "Guides"
