@settings
Feature: Settings: title and description, navigation links, announcement bar
  The settings report the identity of the site, edit the links of its
  navigation and write the announcement shown at the top of every page.

  Background:
    Given I am logged in to the admin as "owner"

  @critical
  Scenario: The settings report the title and the description of the site
    When I go to the settings section "Title & description"
    Then the settings section "Title & description" should show "Test site"
    And the settings section "Title & description" should show "A site for automated tests"
    And the settings section "Title & description" should not show "Another site"

  Scenario: The title of the site is required
    When I press "Edit" in the settings section "Title & description"
    Then the settings section "Title & description" should show "Test site"
    When I set "Site title" to "" in the settings section "Title & description"
    And I press "Save" in the settings section "Title & description"
    Then I should see the field error "Please enter a site title."
    When I press "Cancel" in the settings section "Title & description"
    Then I should not see the field error "Please enter a site title."
    And the settings section "Title & description" should show "Test site"

  Scenario: The menu of the settings reaches a section
    When I go to the settings section "Navigation"
    Then the settings section "Navigation" should show "Set up primary and secondary menus"
    When I go to the settings section "Staff"
    Then the settings section "Staff" should show "Olivia Owner"

  Scenario: A navigation link is added and shows on the site, then is removed
    Given the navigation has no link "Docs"
    When I open the navigation settings
    Then the navigation settings should list the link "Home"
    And the navigation settings should list the link "About"
    And the navigation settings should not list the link "Docs"
    When I add the navigation link "Docs" with the address "/contact/"
    Then the navigation settings should list the link "Docs"
    When I save the navigation settings
    And I go to the homepage
    Then I should see "Docs" in the site navigation
    And I should see "Home" in the site navigation
    When I open the navigation settings
    And I remove the navigation link "Docs"
    Then the navigation settings should not list the link "Docs"
    When I save the navigation settings
    And I go to the homepage
    Then I should not see "Docs" in the site navigation
    And I should see "About" in the site navigation

  Scenario: An announcement shows on the site, then is cleared
    Given there is no announcement
    When I announce "A sale from the suite" to "Public visitors"
    And I go to the homepage
    Then I should see the announcement "A sale from the suite"
    When I go to "/welcome-to-the-test-site/"
    Then I should see the announcement "A sale from the suite"
    When I clear the announcement
    And I go to the homepage
    Then I should not see the announcement "A sale from the suite"
    Given there is no announcement
