@tags
Feature: Tags
  Tags have a name, a slug and a description, count their posts and are
  created, changed and deleted from their own screens.

  Background:
    Given I am logged in to the admin as "editor"
    And there is no tag named "A tag from the suite"

  @critical
  Scenario: The list of tags counts the posts of each tag
    When I go to the admin screen "Tags"
    Then the list should have 3 tags
    And I should see the tag "Guides" in the list
    And the tag "Guides" should have 2 posts
    And the tag "Travel" should have 10 posts
    And the tag "News" should have 5 posts
    And I should not see the tag "A tag from the suite" in the list

  Scenario: A tag opens with its fields
    When I go to the admin screen "Tags"
    And I open the tag "Guides" from the list
    Then the tag name should be "Guides"
    And the tag slug should be "guides"
    And the tag description should be "How to do things."

  Scenario: A tag is created, changed and deleted
    When I go to the admin screen "New tag"
    And I set the tag name to "A tag from the suite"
    Then the tag slug should be "a-tag-from-the-suite"
    When I set the tag description to "Made by the suite."
    And I save the tag
    And I go to the admin screen "Tags"
    Then I should see the tag "A tag from the suite" in the list
    And the tag "A tag from the suite" should have 0 posts
    When I open the tag "A tag from the suite" from the list
    Then the tag description should be "Made by the suite."
    When I set the tag description to "Changed by the suite."
    And I save the tag
    And I go to the admin screen "Tags"
    And I open the tag "A tag from the suite" from the list
    Then the tag description should be "Changed by the suite."
    When I delete the tag
    Then I should be on the admin screen "Tags"
    And I should not see the tag "A tag from the suite" in the list

  Scenario: A tag needs a name
    When I go to the admin screen "New tag"
    And I save the tag
    Then I should see the field error "You must specify a name for the tag."
    And I should be on the admin screen "New tag"

  Scenario: A tag created from the editor appears in the list of tags
    Given there is no post titled "A post from the suite"
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I add the tag "A tag from the suite" to the post
    And I wait for the editor to save
    And I go to the admin screen "Tags"
    Then I should see the tag "A tag from the suite" in the list
    Given there is no post titled "A post from the suite"
    And there is no tag named "A tag from the suite"
    Then I should not see the tag "A tag from the suite" in the list
